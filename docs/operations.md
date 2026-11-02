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
