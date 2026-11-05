# Production operations

## Deployment boundaries

Production uses host Nginx for HTTPS and reverse proxying to container services.
The production checkout contains pre-existing uncommitted changes: do not run
`git reset --hard`, overwrite it, or pull into it without first reviewing and
backing up those changes. Frontend releases have been deployed as built assets
in a replacement frontend image, leaving backend and database containers alone.
Preserve rollback image tags before replacing an image.

Do not commit passwords, private keys, `.env` files, or WebDAV contents.

## 2026-11-01: HTTPS outage and certificate renewal repair

### Evidence

At 05:05 CST, the acme.sh cron job ran and host Nginx was stopped. At 05:05:31,
systemd reported that Nginx could not be reloaded because it was inactive.
The old standalone certificate configuration included a stop pre-hook, a start
post-hook, and a reload installation command. The reason the start hook did not
restore service could not be established from retained logs.

Nginx was started after its configuration passed validation. The frontend and
posts API returned HTTP 200. Available memory was approximately 760 MiB; this
was not evidence of an out-of-memory outage.

### Applied configuration

- acme.sh domain config: `/root/.acme.sh/junziliucong.online_ecc/junziliucong.online.conf`
- `Le_Webroot`: `/var/www/acme`
- Removed stop/start pre/post hooks.
- Certificate reload command: `nginx -t && systemctl reload-or-restart nginx`
- Existing certificate destinations remain `/etc/nginx/ssl/junzi.crt` and
  `/etc/nginx/ssl/junzi.key`.
- Cron output now appends to `/var/log/acme-renewal.log` (including stderr).
- `/etc/logrotate.d/acme-renewal`: weekly rotation, eight compressed archives,
  root-only newly created logs.
- Original configuration and crontab backup:
  `/root/acme-fix-20261101-135508/`.

Host HTTP Nginx server now serves the challenge path before redirecting other
requests to HTTPS:

```nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/acme;
    default_type text/plain;
    try_files $uri =404;
}
location / {
    return 301 https://$host$request_uri;
}
```

Keep the redirect inside `location /`, not at server scope, so it does not
preempt the challenge handler. Keep port 80 reachable for HTTP-01 validation.
This configuration belongs to host `/etc/nginx/conf.d/junzi.conf`, not the
frontend container's Nginx configuration.

### Verification and limitations

- Temporary challenge file returned expected content over public HTTP for both
  `junziliucong.online` and `www.junziliucong.online`; file then removed.
- `nginx -t` passed; `systemctl is-active nginx` returned `active`.
- Website and `/api/posts` returned 200.
- Unauthenticated `/dav/` returned 401 as expected.
- Manual acme.sh cron run completed, skipping issuance because renewal was not
  due. Next scheduled renewal recorded by acme.sh: 2026-11-29T21:05:31Z.
- A complete new ACME issuance was not forced or verified during this repair.

Routine checks:

```sh
nginx -t
systemctl status nginx --no-pager
journalctl -u nginx --since '24 hours ago' --no-pager
tail -n 100 /var/log/acme-renewal.log
openssl x509 -in /etc/nginx/ssl/junzi.crt -noout -dates
```

## Robots and sitemap routing

`GET /robots.txt` and `GET /sitemap.xml` are public backend routes implemented
in `backend/internal/controllers/seo_controller.go`. The origin comes from
`FRONTEND_URL` (falling back to `https://junziliucong.online`), not the request
Host header. Sitemap URLs include the five public static routes, published
non-deleted blog posts, and projects with the same public statuses as the
projects API. Actual update timestamps are used for content `lastmod`; static
routes do not fabricate dates. Responses permit five minutes of client caching.
Publishing or deleting content does not require a frontend rebuild.

The frontend Nginx configuration has exact proxy locations for both routes;
they must not fall through to `/index.html`. Production host Nginx also has
exact locations proxying these paths directly to `http://127.0.0.1:8080`.
Both layers need to keep these routes when redeployed. The robots policy is
crawl guidance only, not authentication, and blocks `/admin`, `/api/`, `/dav/`
and `/login`.

Deployment backup and artifacts:

- Host Nginx backup: `/root/junzi.conf.before-seo`.
- Rollback images: `junziweb-backend:before-seo` and
  `junziweb-frontend:before-seo`.
- Replacement image build contexts: `/root/backend-seo` and `/root/frontend-seo`.
- The deployed backend was built from an isolated snapshot of the production
  backend source, with only the SEO controller and route additions overlaid.
  The production checkout and its unrelated modifications were not overwritten.

Verification: `go test ./...` passed in both the repository and the isolated
production-source build. Public HTTPS endpoints return `text/plain` and
`application/xml`, respectively. The sitemap parsed successfully and matched
all nine current public URLs (five static, two posts, two projects), excluding
the deleted Top-k article; all listed routes returned HTTP 200. Both host and
frontend-container Nginx configurations passed `nginx -t`.

This repair provides crawl discovery, **not full SSR**. Article body text is
still client-rendered, but page-level HTML metadata (title, description,
canonical, `og:*`, Twitter card) is now injected server-side for `/`, `/blog`,
`/blog/:slug`, `/portfolio`, and `/portfolio/:id`, so link previews and
non-executing crawlers receive correct per-page metadata. Unknown slugs and
project IDs return HTTP 404 with `noindex`. Client-side navigations update the
same metadata via `frontend/src/hooks/usePageMeta.ts`.

### Head-injection design

The backend fetches the built SPA shell from the frontend container at
`FRONTEND_INTERNAL_URL` (default `http://frontend`), caching it for 60 seconds with
a 512 KiB read cap and a 5 s timeout. It must request `/index.html` directly:
requesting `/` would loop, because `/` is itself proxied back to the backend.
Responses are `public, max-age=300`. Values are HTML-escaped before insertion and
the existing `<title>`/description/`og:*`/Twitter/canonical tags are removed to
avoid duplicates. If the shell cannot be fetched the handler returns 502.

Remaining gaps: article body is not server-rendered, there is no per-language
variation, no structured data (`Article` JSON-LD), and search-engine indexing has
not been verified.

SEO deployment artifacts: host Nginx backup `/root/junzi.conf.before-seo`;
rollback images `junziweb-backend:before-seo`,
`junziweb-frontend:before-seo`, `junziweb-backend:before-meta`,
`junziweb-frontend:before-page-meta`, `junziweb-frontend:before-seo-assets`;
build contexts `/root/backend-seo`, `/root/backend-meta`, `/root/frontend-seo`,
`/root/frontend-seo-assets`. Verified with `go test ./...` in the repository and
in the isolated production-source snapshot, an E2E client-navigation test, and a
live check of 7 routes (status, single title, description, canonical, og:type,
noindex on 404, SPA shell intact).

## MySQL memory tuning

The host has 2 GB of RAM, while `mysql:8.0` defaults cost ~360 MB of RSS even
with under 1 MB of tables. `docker/mysql/tuning.cnf` is mounted read-only at
`/etc/mysql/conf.d/zz-tuning.cnf` and brings the container to ~113 MB:

| Setting | Default | Now | Why |
|---|---|---|---|
| `performance_schema` | ON | OFF | The default instruments 151 connections and was the largest single cost |
| `innodb_buffer_pool_size` | 128M | 64M | Data is <1 MB |
| `innodb_buffer_pool_chunk_size` | 128M | 8M | Otherwise a 64M pool is rounded back up to 128M |
| `max_connections` | 151 | 100 | Generous headroom, far less per-connection state without `performance_schema` |

Validate before deploying:
`docker run --rm --entrypoint mysqld -v .../tuning.cnf:/etc/mysql/conf.d/zz-tuning.cnf:ro mysql:8.0.40 --validate-config`

Apply with `docker compose up -d --no-deps mysql` (data lives in the
`junziweb_mysql_data` volume, so recreating the container is safe). Verify with
`free -m`, `docker stats`, `/api/health`, the article page and the SSR suite.

Rollback: `cp /root/mysql-tune-backup-*/docker-compose.yml /root/JUNziweb/` then
recreate the container; remove `docker/mysql/tuning.cnf` if it should not be
mounted.

## Server-side rendering (SSR)

Public pages are rendered by a small Node service (`frontend/ssr/server.mjs`,
container `junzi-ssr`, port 3001) and hydrated in the browser afterwards. Nginx
serves `/assets` directly and proxies only HTML routes (`/`, `/resume`,
`/friends`, `/blog*`, `/portfolio*`) to the SSR service.

### How it fits together

1. The request arrives at host Nginx, then the frontend container.
2. The frontend Nginx proxies the page route to `junzi-ssr` (variable upstream
   plus `resolver 127.0.0.11`, so a stopped SSR container cannot block Nginx
   startup). Proxy failures fall back to the client-only `index.html` shell.
3. The SSR service fetches data from the backend API with a 5 s timeout,
   serializes renders (i18next holds one active language per process), renders
   with `StaticRouter`, and injects `<title>`, description, canonical, `og:*`,
   `twitter:*` and `noindex` for 404s.
4. The same payload is embedded as `<script type="application/json"
   id="__SSR_DATA__">`, which the client reads at module init so the first
   client render matches the server markup. JSON data blocks are used instead of
   an inline script because the CSP forbids `unsafe-inline` scripts.
5. `main.tsx` calls `hydrateRoot` when `#root` already has children.
6. Language defaults to **English**; the browser language is not sniffed.
   `__SSR_LANG__` comes from the `lang` cookie, and the header toggle writes both
   the cookie and localStorage so the choice survives reloads. A visitor with an
   older localStorage-only preference is switched after hydration
   (`syncPreferredLanguage`), which cannot cause a mismatch.
7. Theme defaults to **dark** (`themeStore`), and `index.html` plus the SSR
   output set `<html class="dark">` so the first paint matches and there is no
   light flash before hydration. Explicit light/system choices still win.

Dates are formatted through `frontend/src/lib/date.ts` with a pinned timezone.
Formatting with the host timezone produced different dates on the UTC server and
in the visitor's browser, which caused hydration mismatches.

The SSR template is snapshotted from the same client build
(`dist-ssr/template.html`), so the hashed asset names it references always exist
in the deployed frontend image.

### Local SSR regression checks

Build with `pnpm --dir frontend build`, then run
`node e2e/scripts/ssr-regression.mjs`. This starts a local fixture API and the
built SSR server; no production requests or database credentials are used.
Set `CHROMIUM_EXECUTABLE` only when using an existing local Chromium binary.
`pnpm --dir frontend ssr` starts the built server from `dist-ssr/`.

Coverage includes query strings and trailing slashes, real 404 versus upstream
429/503, malformed URL encoding, tag filtering, literal `$&` in article text,
single description tags, legacy language preferences, default dark/English,
hydration without a loading flash, and failed SPA navigation without old content.
API collection runs concurrently; only the shared-i18n render is serialized.
Nginx intercepts SSR 500/502/503/504 and serves the SPA fallback with no-store.

### Verification

`e2e/playwright.ssr.config.ts` checks, against the deployed origin, that all
seven public routes contain server-rendered text with no JavaScript, that each
returns a single correct canonical/title, that hydration logs no errors or
mismatches, that the app still reacts to clicks after hydration, and that
unknown slugs return 404 with `noindex`. Local runs: `pnpm --dir e2e exec
playwright test -c playwright.ssr.config.ts`. The existing friends, markdown and
SEO suites still pass.

### Deployment notes

Rollback images: `junziweb-frontend:before-ssr`, `junziweb-frontend:before-seo-assets`,
`junziweb-ssr` rebuilds from `/root/ssr-app`. The SSR container is attached to
both `junziweb_junzi-frontend` and `junziweb_junzi-backend` networks and limited
to 192 MiB; observed usage is roughly 37 MiB. Production runs it with
`docker run`, because the production checkout keeps unrelated local changes.

### Remaining limitations

- Only the seven public routes are server-rendered; `/admin`, `/login` and
  `/auth/callback` remain client-only.
- Text is rendered in one language per request; there are no `/zh` URLs or
  `hreflang` alternates.
- No `Article` JSON-LD structured data yet.
- React renders are serialized because i18n is shared. API fetches do not hold
  the render queue. Higher traffic would need per-request i18n or a worker pool.
- Frontend and SSR images still build separately: deploy matching assets and
  templates together and verify hashed asset URLs. Do not assume independent
  builds with different Node/pnpm/build environments yield identical hashes.

## WebDAV service

- Public endpoint: `https://junziliucong.online/dav/`.
- Container: `agent-webdav`, rclone WebDAV server.
- Compose configuration: `/root/agent-webdav/compose.yml`.
- Root-only credentials file: `/root/agent-webdav/credentials.env` (not in Git).
- Persistent data: `/srv/agent-webdav` (not in Git).
- Loopback binding: `127.0.0.1:8091`, proxied by host Nginx.
- Container memory limit: 128 MiB; CPU limit: 0.5 CPU.
- Nginx single-request upload limit: 256 MiB.
- Restart policy: `unless-stopped`.

The initial deployment verified authentication, MKCOL, PUT, GET, PROPFIND and
DELETE. Keep agent secrets out of unencrypted sync where possible. Do not
concurrently synchronize live SQLite databases or write the same session file
from multiple devices. Synchronization is not an independent backup.
