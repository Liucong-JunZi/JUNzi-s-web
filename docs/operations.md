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
