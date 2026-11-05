# 13 — Operations

How Hub is installed, run, updated, backed up and moved. Target: the dedicated LAN host (D05).
Everything here is reproducible from the repository (`infra/`), nothing is configured by hand on
the host except `.env` and the DNS entry on the router.

## 1. Host

### 1.1 Ubuntu Server 24.04 LTS (recommended)

Minimum: 4 vCPU, 8 GB RAM, 2 disks (system 60 GB SSD + a second disk/USB ≥ 100 GB for backups).

```bash
# as the first sudo user
sudo apt update && sudo apt -y upgrade
sudo apt -y install ca-certificates curl git ufw unattended-upgrades jq
# static IP (netplan) — pick an address outside the router's DHCP pool, e.g. 192.168.1.20
sudo tee /etc/netplan/01-hub.yaml >/dev/null <<'EOF'
network: { version: 2, ethernets: { eth0: { dhcp4: no, addresses: [192.168.1.20/24], routes: [{ to: default, via: 192.168.1.1 }], nameservers: { addresses: [192.168.1.1, 1.1.1.1] } } } }
EOF
sudo netplan apply
# Docker Engine + compose plugin (official repository)
curl -fsSL https://get.docker.com | sudo sh
# service user, no login shell, member of docker
sudo useradd -r -m -s /usr/sbin/nologin -G docker hub
sudo mkdir -p /srv/hub && sudo chown hub:hub /srv/hub
# firewall: only 80/443 from the LAN subnet, SSH from the LAN
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 80 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 443 proto tcp
sudo ufw enable
# unattended security updates (Docker is excluded from auto-restart; see §7)
sudo dpkg-reconfigure -plow unattended-upgrades
sudo timedatectl set-timezone Europe/Istanbul
```

Docker's own iptables rules bypass ufw for **published** ports; `compose.yaml` publishes only
Caddy's 80/443 bound to `0.0.0.0` and nothing else, so ufw's allow-lists are the effective policy.
For stricter filtering add `{ "iptables": false }`-free alternative: bind Caddy to the LAN IP
(`192.168.1.20:443:443`).

Hub runs as the `hub` user: `sudo -u hub -H bash` for every compose command (or
`sudo loginctl enable-linger hub` and a systemd unit, §1.3).

### 1.2 Windows 11 + Docker Desktop (fallback)

Same compose files. Differences: WSL 2 backend required; store the checkout inside the WSL
filesystem (`\\wsl$\Ubuntu\srv\hub`) for volume performance; Docker Desktop must auto-start and
"Start Docker Desktop when you sign in" must be on with auto-login configured on the machine;
firewall rule "Hub 80/443, Private profile only"; backups to a second drive letter. Not recommended
because reboots after Windows Update pause the service until someone signs in.

### 1.3 Autostart

`infra/systemd/hub.service` (installed by `infra/scripts/install-host.sh`):

```ini
[Unit]
Description=Hub (docker compose)
Requires=docker.service
After=docker.service network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
User=hub
WorkingDirectory=/srv/hub/hub
ExecStart=/usr/bin/docker compose -f infra/compose.yaml --env-file .env up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f infra/compose.yaml --env-file .env down
[Install]
WantedBy=multi-user.target
```

## 2. DNS and the name `hub.goteav.lan`

| Option | How | Notes |
| --- | --- | --- |
| Router DNS entry (preferred) | add a static host `hub.goteav.lan → 192.168.1.20` in the router's DNS/DHCP page | every device on the LAN resolves it, including phones |
| Hosts file (fallback) | `192.168.1.20  hub.goteav.lan` in `C:\Windows\System32\drivers\etc\hosts` / `/etc/hosts` | the team-pack installer prints the exact line and command (admin needed) |
| IP only | `https://192.168.1.20` | works (the certificate also carries the IP SAN); push notifications still require the trusted CA |

`.lan` is not a public TLD and is not resolvable from the internet; never use `.local` (mDNS
conflicts on macOS/Windows).

## 3. Caddy

`infra/caddy/Caddyfile`:

```caddyfile
{
  admin off
  email ops@goteav.com
  # internal CA: certificates for the LAN name and IP, root cert exported for the team
  pki { ca local { name "Hub Internal CA" } }
  servers { trusted_proxies static private_ranges }
}

# bootstrap: plain HTTP only serves the root certificate and redirects everything else
http://hub.goteav.lan, http://192.168.1.20 {
  handle /ca.crt {
    root * /data/caddy/pki/authorities/local
    rewrite * /root.crt
    file_server
    header Content-Type application/x-x509-ca-cert
  }
  handle { redir https://hub.goteav.lan{uri} permanent }
}

https://hub.goteav.lan, https://192.168.1.20 {
  tls internal
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options nosniff
    X-Frame-Options SAMEORIGIN
    Referrer-Policy strict-origin-when-cross-origin
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'"
    -Server
  }
  log { output file /data/access.log { roll_size 50mb roll_keep 10 } format json }

  @api path /api/* /mcp /health/* /metrics
  handle @api {
    reverse_proxy api:7310 { flush_interval -1 }      # -1: stream SSE and MCP responses immediately
  }
  handle /lab/* {
    root * /srv/lab-dist
    uri strip_prefix /lab
    try_files {path} /index.html
    file_server
  }
  handle /team-pack/* {
    root * /srv/team-pack
    uri strip_prefix /team-pack
    file_server
  }
  handle { reverse_proxy web:7300 }
}
```

Notes: `/metrics` is additionally restricted in the api by a basic-auth token
(`METRICS_TOKEN`) so it is not open to every LAN device; the SSE stream `/api/v1/workspaces/*/events/stream`
works through `flush_interval -1`; the lab is a static build (`/srv/lab-dist` volume filled by the
`lab` image, §5.3); the team-pack marketplace/zip (`/srv/team-pack`) is copied by CI into the
`web` image's `public/team-pack` or mounted from the checkout — pick one in H1 (mount is simpler).

Export the root CA (for the installer and for manual trust): it is `GET http://hub.goteav.lan/ca.crt`,
or on the host `docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./hub-root-ca.crt`.
Print its fingerprint for Settings › System: `openssl x509 -in hub-root-ca.crt -noout -fingerprint -sha256`.
The root is valid 10 years; leaf certificates renew automatically. **Keep the `caddy_data` volume
in backups** — losing it means a new root CA and re-trusting on every machine.

## 4. `infra/compose.yaml`

**First release (docs/15 §3, §9):** the file in the repository runs web, api, worker, postgres and redis on `localhost` with no Caddy, as project `hub-stack`, with images built locally (`infra/docker/*.Dockerfile`) and folders bound by `HUB_LAB_FOLDER` and `HUB_DOCS_FOLDER`. Its header says how to run it beside the dev stack. `infra/scripts/smoke.sh` checks it. What follows is the later LAN shape, kept for H6.

```yaml
name: hub
x-api-env: &api-env
  env_file: ../.env
  environment:
    NODE_ENV: production
    TZ: ${TZ:-Europe/Istanbul}
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - lab_dist:/srv/lab-dist:ro
      - ../packages/team-pack/dist:/srv/team-pack:ro
    depends_on: { web: { condition: service_healthy }, api: { condition: service_healthy } }
    deploy: { resources: { limits: { memory: 128M } } }

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment: { POSTGRES_DB: hub, POSTGRES_USER: hub, POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} }
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro     # 01-extensions.sql
      - backups:/backups
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U hub -d hub"], interval: 10s, timeout: 5s, retries: 10 }
    command: ["postgres", "-c", "shared_buffers=256MB", "-c", "max_connections=60", "-c", "log_min_duration_statement=500"]
    deploy: { resources: { limits: { memory: 768M } } }

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "128mb", "--maxmemory-policy", "noeviction"]
    volumes: [redisdata:/data]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 10s, timeout: 3s, retries: 10 }
    deploy: { resources: { limits: { memory: 192M } } }

  migrate:
    image: ghcr.io/alremaal-co/hub-api:${HUB_VERSION:-main}
    <<: *api-env
    command: ["sh", "-c", "pnpm prisma:deploy && pnpm prisma:seed"]
    depends_on: { postgres: { condition: service_healthy } }
    restart: "no"

  api:
    image: ghcr.io/alremaal-co/hub-api:${HUB_VERSION:-main}
    <<: *api-env
    environment: { PROCESS_ROLE: api, PORT: "7310" }
    volumes: [repos:/repos]
    depends_on:
      migrate: { condition: service_completed_successfully }
      redis: { condition: service_healthy }
    healthcheck: { test: ["CMD", "node", "dist/healthcheck.js"], interval: 15s, timeout: 5s, retries: 5, start_period: 20s }
    restart: unless-stopped
    read_only: true
    tmpfs: [/tmp]
    deploy: { resources: { limits: { memory: 512M } } }

  worker:
    image: ghcr.io/alremaal-co/hub-api:${HUB_VERSION:-main}
    <<: *api-env
    environment: { PROCESS_ROLE: worker }
    volumes: [repos:/repos]                        # git clones of the sources (read-write)
    depends_on: { api: { condition: service_healthy } }
    healthcheck: { test: ["CMD", "node", "dist/healthcheck.js", "--worker"], interval: 30s, timeout: 5s, retries: 5, start_period: 20s }
    restart: unless-stopped
    deploy: { resources: { limits: { memory: 512M }, replicas: 1 } }   # exactly one: Telegram long polling + repeatable jobs

  web:
    image: ghcr.io/alremaal-co/hub-web:${HUB_VERSION:-main}
    env_file: ../.env
    environment: { PORT: "7300", NEXT_PUBLIC_HUB_URL: ${HUB_PUBLIC_URL} }
    healthcheck: { test: ["CMD", "wget", "-qO-", "http://127.0.0.1:7300/api/healthz"], interval: 15s, timeout: 5s, retries: 5, start_period: 20s }
    restart: unless-stopped
    deploy: { resources: { limits: { memory: 384M } } }

  lab:
    image: ghcr.io/alremaal-co/hub-lab:${HUB_VERSION:-main}   # static build; copies dist into the volume and exits
    command: ["sh", "-c", "rm -rf /srv/lab-dist/* && cp -r /app/dist/. /srv/lab-dist/"]
    volumes: [lab_dist:/srv/lab-dist]
    restart: "no"

volumes: { pgdata: {}, redisdata: {}, repos: {}, caddy_data: {}, caddy_config: {}, lab_dist: {}, backups: { driver: local, driver_opts: { type: none, o: bind, device: /mnt/backup/hub } } }
```

`compose.dev.yaml` (developer machines): `postgres` (port 7332), `redis` (7379), `mailpit`
(7325 SMTP / 7326 UI) only; apps run with `pnpm dev`.

## 5. Images

### 5.1 `infra/docker/api.Dockerfile`

```dockerfile
FROM node:22-bookworm-slim@sha256:<pinned> AS base
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends git openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm fetch
FROM deps AS build
COPY . .
RUN pnpm install --frozen-lockfile --offline \
 && pnpm --filter @hub/contracts build \
 && pnpm --filter @hub/api prisma:generate \
 && pnpm --filter @hub/api build \
 && pnpm --filter @hub/api --prod deploy /out
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /out /app
COPY --from=build /app/apps/api/prisma /app/prisma
RUN mkdir -p /repos && chown -R node:node /app /repos
USER node
EXPOSE 7310
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node dist/healthcheck.js
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "dist/main.js"]
```

`git` is in the runtime image because the worker clones/fetches sources and pushes ADR branches.
`entrypoint.sh` writes a `~/.gitconfig` for the `node` user (name "Hub", email `hub@goteav.lan`)
and configures a credential helper that reads the per-source token from the environment the job
sets for each `git` call (`GIT_ASKPASS` script), so no token is written to disk.

### 5.2 `infra/docker/web.Dockerfile`

Next.js `output: 'standalone'`; same deps/build pattern; runner copies `.next/standalone`,
`.next/static`, `public/`; `USER node`; `EXPOSE 7300`; healthcheck on `/api/healthz` (a trivial
route handler). Build arg `NEXT_PUBLIC_HUB_URL` is **not** baked in — the web app uses relative
`/api` paths through Caddy.

### 5.3 `infra/docker/lab.Dockerfile`

```dockerfile
FROM node:22-bookworm-slim@sha256:<pinned> AS build
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
ARG GOTEAV_WEB_REF=main
ARG GOTEAV_DASH_REF=main
# read-only token passed as a BuildKit secret, never stored in a layer
RUN --mount=type=secret,id=goteav_token \
    T=$(cat /run/secrets/goteav_token) \
 && git clone --depth 1 --branch "$GOTEAV_WEB_REF"  "https://x-access-token:${T}@github.com/Alremaal-Co/Goteav.git" goteav-web \
 && git clone --depth 1 --branch "$GOTEAV_DASH_REF" "https://x-access-token:${T}@github.com/Alremaal-Co/Goteav-Dashboard.git" goteav-dashboard \
 && rm -rf goteav-web/.git goteav-dashboard/.git
COPY . hub
WORKDIR /src/hub
RUN pnpm install --frozen-lockfile --filter @hub/lab... \
 && (cd /src/goteav-web && pnpm install --frozen-lockfile --ignore-scripts) \
 && (cd /src/goteav-dashboard && pnpm install --frozen-lockfile --ignore-scripts) \
 && LAB_WEB_SRC=/src/goteav-web/src LAB_DASH_SRC=/src/goteav-dashboard/src pnpm --filter @hub/lab build -- --base=/lab/
FROM alpine:3.20
COPY --from=build /src/hub/apps/lab/dist /app/dist
```

The lab imports real `ui` primitives from both Goteav apps, so their dependencies must be
installed (ignore-scripts; no build). Refs are pinned in `infra/lab-sources.json` and bumped by a
PR when the lab needs newer primitives. Build: `docker build -f infra/docker/lab.Dockerfile
--secret id=goteav_token,env=GOTEAV_READ_TOKEN --build-arg GOTEAV_WEB_REF=… .`.

## 6. Environment variables (`.env.example` is the source of truth)

| Name | Service | Required | Example | Meaning |
| --- | --- | --- | --- | --- |
| `HUB_PUBLIC_URL` | api, web | yes | `https://hub.goteav.lan` | public origin; cookies, links in notifications, allowedHosts |
| `HUB_ALLOWED_HOSTS` | api | yes | `hub.goteav.lan,192.168.1.20` | Host header allow-list for MCP and API |
| `DATABASE_URL` | api, worker, migrate | yes | `postgresql://hub:<pw>@postgres:5432/hub?schema=public` | |
| `POSTGRES_PASSWORD` | postgres | yes | 32 random chars | used to build `DATABASE_URL` |
| `REDIS_URL` | api, worker | yes | `redis://redis:6379/0` | |
| `HUB_SECRET_KEY` | api, worker | yes | `openssl rand -base64 32` | AES-256-GCM key for `secret_enc`/`totp_secret_enc` (rotation: `pnpm ops:rotate-key`) |
| `HUB_JWT_SECRET` | api | yes | `pnpm setup:env`, or 32+ random chars | HS256 key of the access token (15 min) and the TOTP challenge (5 min) |
| `SESSION_COOKIE_DOMAIN` | api | no | `hub.goteav.lan` | defaults to the public URL host |
| `TRUST_PROXY` | api | behind a proxy | `uniquelocal` | Express `trust proxy`. `infra/compose.yaml` sets it, because the API sits behind the web container; otherwise every request looks like the proxy's, sharing one sign-in limit and writing the wrong address to audit. Never set it where the API is reachable directly from outside. |
| `PROCESS_ROLE` | api/worker | yes | `api` \| `worker` | which processors register |
| `PORT` | api, web | yes | `7310` / `7300` | |
| `TZ` | all | no | `Europe/Istanbul` | container clock; workspaces have their own timezone setting |
| `LOG_LEVEL` | api, worker | no | `info` | pino |
| `METRICS_TOKEN` | api | no | random | required as `Authorization: Bearer` on `/metrics`; unset = metrics disabled |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | api, worker, web(public) | for push | `npx web-push generate-vapid-keys`; subject `mailto:ops@goteav.com` | web push |
| `TELEGRAM_BOT_TOKEN` | worker | for telegram | from @BotFather | long polling; unset = channel disabled |
| `MAIL_PROVIDER` | worker | no | `resend` \| `smtp` \| `none` | |
| `RESEND_API_KEY` | worker | if resend | | |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | worker | if smtp | mailpit in dev: `mailpit:1025` | |
| `MAIL_FROM` | worker | if mail | `Hub <hub@goteav.com>` | |
| `HUB_OWNER_EMAIL` / `HUB_OWNER_PASSWORD` / `HUB_OWNER_NAME` | migrate (seed) | first run only | | creates the first workspace owner if no user exists; remove afterwards |
| `HUB_WORKSPACE_SLUG` / `HUB_WORKSPACE_NAME` / `HUB_WORKSPACE_PREFIX` | migrate (seed) | first run only | `goteav` / `Goteav` / `GTV` | first workspace |
| `REPOS_ROOT` | worker | no | `/repos` | where clones live |
| `HUB_VERSION` | compose | no | `main` \| `sha-abc1234` | image tag |
| `LAB_WEB_SRC` / `LAB_DASH_SRC` | lab build, lab dev | lab only | paths to the two `src/` roots | Vite aliases |
| `GOTEAV_READ_TOKEN` | lab build (secret), CI | lab only | fine-grained token, contents:read | never in `.env` on the host unless the lab is rebuilt there |
| `NEXT_PUBLIC_HUB_URL` | web | no | `https://hub.goteav.lan` | shown in Settings › System; API calls are relative |

**Not in env**: GitHub tokens for capture sources (stored encrypted per source in the DB),
anything a `need` tracks.

## 7. First run

```bash
sudo -u hub -H bash
cd /srv/hub && git clone https://github.com/Alremaal-Co/hub.git && cd hub   # deploy key or token with read access
cp .env.example .env && nano .env            # fill: POSTGRES_PASSWORD, HUB_SECRET_KEY, HUB_JWT_SECRET, HUB_PUBLIC_URL, HUB_OWNER_*, HUB_WORKSPACE_*
sudo mkdir -p /mnt/backup/hub && sudo chown hub:hub /mnt/backup/hub   # second disk mounted at /mnt/backup
docker compose -f infra/compose.yaml --env-file .env pull     # or build locally: docker compose … build
docker compose -f infra/compose.yaml --env-file .env up -d    # migrate runs first, seeds the owner + workspace
docker compose -f infra/compose.yaml --env-file .env ps       # all healthy
infra/scripts/smoke.sh                                        # §9: health, TLS, headers, sign-in page, /lab/
```

Then in the browser (owner):

1. `https://hub.goteav.lan` → trust the CA on this first machine (download `http://hub.goteav.lan/ca.crt`), sign in with `HUB_OWNER_*`, enable TOTP (required for owner).
2. Settings › General: timezone, locale. Settings › System: copy the CA fingerprint into the team announcement.
3. Settings › Sources: add `backend`, `web`, `dashboard`, `hub` (GitHub, fine-grained token read-only), `backend docs` (docs folder on `backend`, path `docs`, exclude `map/**`, `handover/**`), `lab` (root `apps/lab` of the `hub` clone). Click "Test" (clone + first poll).
4. Settings › Tokens: create the owner's MCP token; run `npx @hub/team-pack init` on the owner's machine.
5. Import Goteav history: `docker compose exec api node dist/scripts/import-goteav.js --dry-run` then without `--dry-run` (reads `docs/map/data/_decisions.yaml`, `_suggestions.yaml`, `docs/status/*.md` and `.goteav-ops/contract-changes.md` from the backend clone; see `06-capture-adapters.md`).
6. Members: invite each teammate with roles; they run the installer with their own token.
7. Remove `HUB_OWNER_PASSWORD` from `.env`.

## 8. Update and rollback

```bash
cd /srv/hub/hub
git fetch && git checkout <tag-or-main> && git pull --ff-only
docker compose -f infra/compose.yaml --env-file .env pull            # or build
docker compose -f infra/compose.yaml --env-file .env up -d           # migrate → api → worker → web → lab copy
docker compose -f infra/compose.yaml --env-file .env ps && infra/scripts/smoke.sh
docker image prune -f
```

Release tags: `vYYYY.MM.DD` (+ `-n`) on `main`; images tagged `sha-<short>` and the tag.
Migrations are forward-only; a rollback is `HUB_VERSION=<previous tag> docker compose up -d`
**only if** the newer version added no migration (check `docs/status/<date>.md` of the release;
`prisma migrate status` lists applied ones). If it did, restore the pre-update backup (§9) instead
— `infra/scripts/update.sh` takes a backup automatically before pulling.

## 9. Backups

| What | How | Where | Retention |
| --- | --- | --- | --- |
| Postgres | `infra/scripts/backup.sh`: `pg_dump -Fc` from the `postgres` container, `zstd`, name `hub-YYYYMMDD-HHMM.dump.zst`, `sha256sum` beside it; systemd timer at 02:30 | `/mnt/backup/hub/daily/` (second disk) | 14 daily |
| Weekly copy | Sunday 03:00: copy the newest dump + `caddy_data` tarball + `.env` (GPG-encrypted with the owner's public key) | external USB disk rotated by the owner, or `rclone` to the owner's machine over LAN | 8 weekly, 6 monthly |
| `caddy_data` | tar of the volume (root CA + keys) | with the weekly copy | same |
| `.env` | encrypted copy | weekly | same |
| `repos/` volume | **not backed up** (re-cloned on demand) | | |
| `redisdata` | not backed up (queues are reconstructable; outbox lives in Postgres) | | |

Restore drill (quarterly, written to `docs/status/restore-drill-<date>.md`):

```bash
docker compose -f infra/compose.yaml --env-file .env stop api worker web
docker compose -f infra/compose.yaml --env-file .env exec -T postgres sh -c 'dropdb -U hub hub --if-exists && createdb -U hub hub'
zstd -dc /mnt/backup/hub/daily/hub-20261103-0230.dump.zst | docker compose -f infra/compose.yaml --env-file .env exec -T postgres pg_restore -U hub -d hub --no-owner
docker compose -f infra/compose.yaml --env-file .env up -d
infra/scripts/smoke.sh && echo "sign in, open Timeline, check the newest card is from before the backup time"
```

`infra/scripts/restore.sh <dump>` wraps this and refuses to run without `--yes`.

## 10. Monitoring

| Signal | Where |
| --- | --- |
| Liveness/readiness | `GET /health/live` (process up), `GET /health/ready` (Postgres, Redis, `/repos` writable, migrations applied) — Caddy only proxies; compose healthchecks restart unhealthy containers |
| Metrics | `GET /metrics` (prom-client, bearer `METRICS_TOKEN`): `hub_http_request_duration_seconds`, `hub_queue_jobs{queue,state}`, `hub_source_lag_seconds{source}`, `hub_outbox_pending`, `hub_sse_connections`, `hub_capture_errors_total{source}`; optional Prometheus + Grafana compose overlay `infra/compose.monitoring.yaml` (not started by default) |
| In-app | Settings › System: version, uptime, per-source last success/lag/error, outbox backlog, last backup time + size (reads `/mnt/backup` listing through the worker), CA fingerprint, disk free |
| Alerts | the worker sends a `system` notification to `owner`/`pm` when: a source has failed 5 polls in a row, outbox backlog > 200 for 15 min, disk free < 10 %, backup older than 36 h |
| Logs | pino JSON to stdout → `docker logs` with json-file driver `max-size 50m, max-file 5` (set in compose `logging:`); Caddy access log rolled by Caddy |

## 11. Runbook — common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| Source "backend" lag growing, error `rate limited` | GitHub REST limit (5 000/h per token) exhausted by frequent polling of many branches | raise `capture.github.interval_sec` to 300, narrow `branch_patterns`; the client already honours `X-RateLimit-Reset` and uses conditional requests (`ETag`) |
| Source error `401 Bad credentials` | token revoked/expired (fine-grained tokens expire) | Settings › Sources › edit → paste a new token → Test |
| `lab` image build fails: `Could not resolve @/components/ui/...` | Goteav repos moved a primitive or the pinned refs are stale | bump `infra/lab-sources.json` refs; if a primitive was renamed, fix the lab version that imports it (lab versions are frozen by design — add a new version instead) |
| Postgres `No space left on device` | disk full (logs, `pgdata` growth, dumps on the system disk by mistake) | `docker system prune -f`, check `du -sh /var/lib/docker/volumes/*`, make sure `backups` binds to `/mnt/backup`; `VACUUM` is automatic; purge jobs (`03-data-model §13`) run nightly |
| Push notifications stopped after a Caddy change | new root CA (volume lost) → browsers distrust the origin → service worker fails | restore `caddy_data` from backup or redistribute the new CA (`hub init` again on every machine); push subscriptions with `failedAt` set are dropped after 7 days |
| Telegram: `409 Conflict: terminated by other getUpdates request` | two workers polling the same bot (a second worker container or a developer running the worker locally with the production token) | keep `worker` at 1 replica; developers use their own test bot token |
| MCP: Claude Code shows "connection failed" for `hub` | CA not trusted by Node (`NODE_EXTRA_CA_CERTS` not set in the new terminal), DNS, or token revoked | `hub doctor` on the teammate's machine |
| Session cards appear without summary for everyone | teammates skip `/hub:done`; or `mark-summary` hook missing | check `Settings › System › Team pack versions`; remind; the Today page lists them |
| Timeline slow | missing index after a new filter, or `card_events` not vacuumed | `EXPLAIN ANALYZE` the query logged by `log_min_duration_statement=500`; add the index via migration |
| Worker restarts in a loop | migration pending (`ready` fails) or Redis `noeviction` OOM | `docker compose logs worker`; `docker compose run --rm migrate`; raise Redis `maxmemory` if the queue backlog is genuine |
| Clock drift (reminders at wrong times) | host NTP off | `timedatectl set-ntp true` |

## 12. Moving to a VPS (later)

Checklist, in order:

1. Provision and harden the server with the `vps-forge` skill (SSH keys, ufw, fail2ban, Docker,
   unattended upgrades, backups, monitoring).
2. DNS: `hub.<domain>` A record → VPS; keep `hub.goteav.lan` for a week with a redirect.
3. Caddy: swap in `infra/caddy/Caddyfile.vps` (`tls` with Let's Encrypt via the `email`, no
   `pki`, no `/ca.crt` block); set `HUB_PUBLIC_URL`, `HUB_ALLOWED_HOSTS`, `SESSION_COOKIE_DOMAIN`.
4. Team pack: `hub init --url https://hub.<domain>` on every machine removes the private CA env
   var; tokens stay valid.
5. GitHub capture: enable webhooks — set `GITHUB_WEBHOOK_SECRET`, register `push` +
   `pull_request` webhooks to `https://hub.<domain>/api/v1/capture/github-webhook` on the four
   repositories; polling drops to 15 min as a safety net.
6. Push: no change (VAPID keys are origin-independent) — subscriptions are re-created on first
   visit to the new origin.
7. Deploy procedure through the `secure-deploy` skill (service user, read-only code, atomic
   release, post-deploy audit).
8. Backups off-site: `rclone` nightly to an object store; test a restore on the VPS.
9. Restore the LAN host data: `pg_dump` from the LAN host → `pg_restore` on the VPS during a
   30-minute freeze window; verify with `smoke.sh`; switch DNS.

## 13. Capacity targets

| Resource | Target / estimate |
| --- | --- |
| RAM idle, all containers | ≤ 2 GB (limits above sum to 2.5 GB; typical idle ~1.2 GB) |
| CPU | < 10 % average on 4 vCPU; GitHub polls and docs indexing are the spikes |
| Postgres size | ~5 MB per 1 000 cards incl. events/comments; docs chunks ~2 MB per 100 docs; estimate < 500 MB after two years at this team size |
| `repos/` volume | sum of the four clones (backend ~300 MB with history; shallow clones `--depth 200` used) ≈ 1 GB |
| Backups | ~50 MB per daily dump compressed → 14 days ≈ 1 GB + weekly set ≈ 1 GB |
| Lab dist | ~30 MB |
| Network | LAN only; GitHub polling ≈ 4 sources × 30 requests/h |
