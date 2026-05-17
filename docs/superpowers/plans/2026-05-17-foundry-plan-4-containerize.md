# Foundry Plan 4: Containerize + Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Containerize the full foundry stack (postgres + api + web + backup sidecar), provide a single `scripts/foundry` CLI for ops, and configure systemd autostart so the stack survives reboots without manual intervention. Database backups run daily via a battle-tested sidecar with a documented restore path.

**Architecture:** podman-compose orchestrates 4 services on a bridge network:
- `postgres` (pgvector/pgvector:pg16) — same as before, port 5433
- `api` (custom multi-stage build of @foundry/api) — port 5380, runs migrations on startup
- `web` (custom multi-stage build → nginx) — port 5173, proxies /v1 and /mcp to `api`
- `backup` (prodrigestivill/postgres-backup-local) — sidecar, daily pg_dump to `~/foundry-backups/`

Production-style images (built once, run via node — not dev mode). Dev work continues via `npm run dev` outside containers. Restart policy `unless-stopped` everywhere. Linux user session enables `loginctl enable-linger` + `podman-restart.service` to start containers on boot before login.

**Tech stack additions:** `podman-compose`, `prodrigestivill/postgres-backup-local:16`, `nginx:alpine`, `node:22-slim` base image, systemd user services.

**Reference spec:** `docs/superpowers/specs/2026-05-16-foundry-design.md`
**Prior plans:** Plans 1, 2, 3 (foundation, backend, frontend — all merged to main).

---

## Task 1: apps/api Dockerfile (multi-stage, workspace-aware)

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`
- Create: `apps/api/entrypoint.sh`

The api workspace has three concerns inside a container:
1. **Workspace deps** — `@foundry/shared` and `@foundry/db` live in `packages/*`; they must be present to import.
2. **Migrations** — `packages/db/migrations/*.sql` must be readable so `npm run migrate` can apply them at startup.
3. **Runtime** — we run TypeScript via `tsx` (no build step needed; matches dev). This trades image size for simplicity and avoids ESM path issues from `tsc` output.

**Multi-stage Dockerfile:**

```dockerfile
# syntax=docker/dockerfile:1.7

# --- Stage 1: deps ---
# Install all workspace deps with the FULL monorepo lockfile so workspace
# protocol resolves correctly.
FROM node:22-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN npm ci

# --- Stage 2: runtime ---
FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

# Copy installed deps from the deps stage
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/apps/mcp/node_modules ./apps/mcp/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/package.json /repo/package-lock.json ./
COPY --from=deps /repo/apps/api/package.json apps/api/
COPY --from=deps /repo/apps/mcp/package.json apps/mcp/
COPY --from=deps /repo/packages/shared/package.json packages/shared/
COPY --from=deps /repo/packages/db/package.json packages/db/

# Copy source (workspaces needed at runtime by tsx)
COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/mcp/tsconfig.json apps/mcp/
COPY apps/mcp/src apps/mcp/src
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY packages/db/tsconfig.json packages/db/
COPY packages/db/src packages/db/src
COPY packages/db/migrations packages/db/migrations
COPY packages/db/drizzle.config.ts packages/db/

COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Non-root user
RUN groupadd -r foundry && useradd -r -g foundry -d /home/foundry -m foundry \
    && chown -R foundry:foundry /repo
USER foundry

EXPOSE 5380
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "--import", "tsx", "apps/api/src/boot.ts"]
```

**`apps/api/.dockerignore`:**

```
node_modules
**/node_modules
dist
build
*.tsbuildinfo
coverage
.env
.env.*
.git
.superpowers
docs
.claude
test-results
playwright-report
```

**`apps/api/entrypoint.sh`:**

```bash
#!/bin/sh
set -e
echo "==> Running migrations against ${DB_URL_MIGRATE:-not set}"
node --import tsx packages/db/src/scripts/migrate.ts
echo "==> Starting api"
exec "$@"
```

**Build & verification (deferred to Task 5):**

```bash
podman build -f apps/api/Dockerfile -t foundry-api:dev .
podman run --rm -e DB_URL_MIGRATE=... -e DB_URL_APP=... -p 5380:5380 foundry-api:dev
curl -sf http://localhost:5380/v1/healthz
```

- [ ] **Step 1:** Write `apps/api/Dockerfile`, `apps/api/.dockerignore`, `apps/api/entrypoint.sh` per above.
- [ ] **Step 2:** `chmod +x apps/api/entrypoint.sh` then `git add` the files (use `git add --chmod=+x` if needed, or `chmod` then `update-index --chmod=+x` to set the executable bit in git's index — `git config core.fileMode true` is the default on linux so the chmod alone usually works).
- [ ] **Step 3:** Build the image: `podman build -f apps/api/Dockerfile -t foundry-api:dev .`. Should complete without errors. Note the image size.
- [ ] **Step 4:** Commit:
  ```bash
  git add apps/api/Dockerfile apps/api/.dockerignore apps/api/entrypoint.sh
  git commit -m "feat(api): production Dockerfile with deps + runtime stages

  Multi-stage build: deps stage runs npm ci against the full monorepo
  lockfile so workspace protocol resolves correctly; runtime stage copies
  node_modules + source for tsx execution. entrypoint runs migrations
  via packages/db/src/scripts/migrate.ts before starting the server.
  Non-root user (foundry:foundry) with /home/foundry."
  ```

---

## Task 2: apps/web Dockerfile + nginx.conf

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `apps/web/.dockerignore`

**`apps/web/Dockerfile`:**

```dockerfile
# syntax=docker/dockerfile:1.7

# --- Stage 1: build ---
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# Build the SPA into apps/web/dist
RUN npm run build --workspace @foundry/web

# --- Stage 2: nginx runtime ---
FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**`apps/web/nginx.conf`:**

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback: any unknown path returns index.html so React Router takes over
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Proxy api requests to the api container by compose service name
  location /v1/ {
    proxy_pass http://api:5380;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
  }

  location /mcp/ {
    proxy_pass http://api:5380;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
  }

  # Long cache for hashed assets (Vite outputs hashed filenames in /assets)
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }
}
```

**`apps/web/.dockerignore`:**

```
node_modules
**/node_modules
dist
build
coverage
test-results
playwright-report
.env
.env.*
.git
.superpowers
docs
```

- [ ] **Step 1:** Write all three files.
- [ ] **Step 2:** Build the image: `podman build -f apps/web/Dockerfile -t foundry-web:dev .`. Should complete; note the size.
- [ ] **Step 3:** Commit:
  ```bash
  git add apps/web/Dockerfile apps/web/.dockerignore apps/web/nginx.conf
  git commit -m "feat(web): production Dockerfile (vite build → nginx alpine)

  Two stages: node:22-slim builds the SPA via npm workspaces; nginx:alpine
  serves the static dist with SPA fallback (try_files ... /index.html) and
  proxies /v1 and /mcp to the api container by compose service name.
  Hashed /assets/* served with 1y immutable Cache-Control."
  ```

---

## Task 3: Rewrite docker-compose.yml with 4 services

**Files:**
- Modify: `docker/docker-compose.yml`
- Modify: `.env.example` (add backup-related env vars)
- Update: `.gitignore` (gitignore `docker/backups/` if it accumulates anything)

**`docker/docker-compose.yml`:**

```yaml
services:
  postgres:
    image: docker.io/pgvector/pgvector:pg16
    container_name: foundry-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: foundry
      POSTGRES_PASSWORD: foundry
      POSTGRES_DB: foundry
    ports:
      - '5433:5432'
    volumes:
      - foundry-pgdata:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U foundry -d foundry']
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
    networks:
      - foundry-net

  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    image: foundry-api:latest
    container_name: foundry-api
    restart: unless-stopped
    environment:
      DB_URL_MIGRATE: postgres://foundry:foundry@postgres:5432/foundry
      DB_URL_APP: postgres://foundry_app:foundry_app@postgres:5432/foundry
      FOUNDRY_HEARTBEAT_TTL_SEC: 1800
      LOG_LEVEL: info
      HOST: 0.0.0.0
      PORT: 5380
    ports:
      - '5380:5380'
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ['CMD-SHELL', "node -e \"fetch('http://localhost:5380/v1/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 30s
    networks:
      - foundry-net

  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
    image: foundry-web:latest
    container_name: foundry-web
    restart: unless-stopped
    ports:
      - '5173:80'
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ['CMD-SHELL', "wget -q --spider http://localhost/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - foundry-net

  backup:
    image: docker.io/prodrigestivill/postgres-backup-local:16
    container_name: foundry-backup
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: foundry
      POSTGRES_USER: foundry
      POSTGRES_PASSWORD: foundry
      POSTGRES_EXTRA_OPTS: '--blobs --no-owner --quote-all-identifiers'
      SCHEDULE: '@daily'
      BACKUP_KEEP_DAYS: 7
      BACKUP_KEEP_WEEKS: 4
      BACKUP_KEEP_MONTHS: 6
      HEALTHCHECK_PORT: 8080
    volumes:
      - ${FOUNDRY_BACKUP_DIR:-~/foundry-backups}:/backups
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - foundry-net

volumes:
  foundry-pgdata:
    name: foundry-pgdata

networks:
  foundry-net:
    name: foundry-net
    driver: bridge
```

**Updated `.env.example` additions:**

```
# Backup directory on host (bind-mounted into the backup sidecar)
FOUNDRY_BACKUP_DIR=~/foundry-backups
```

- [ ] **Step 1:** Rewrite the compose file.
- [ ] **Step 2:** Append to `.env.example`. Then run `cp .env.example .env` if `.env` lacks the new var; or add it manually.
- [ ] **Step 3:** Create the backup target dir: `mkdir -p ~/foundry-backups`.
- [ ] **Step 4:** Commit:
  ```bash
  git add docker/docker-compose.yml .env.example
  git commit -m "feat(docker): compose for full stack (postgres+api+web+backup) + bridge network

  4 services on the foundry-net bridge: postgres (unchanged), api (built from
  apps/api/Dockerfile, runs migrations on startup, healthcheck via /v1/healthz),
  web (nginx serving the SPA + proxying to api by service name), and a
  postgres-backup-local sidecar (daily, 7/4/6 retention) bind-mounting
  FOUNDRY_BACKUP_DIR (defaults to ~/foundry-backups). restart: unless-stopped
  everywhere; depends_on uses service_healthy conditions so startup is ordered."
  ```

---

## Task 4: scripts/foundry CLI + install-systemd-autostart.sh

**Files:**
- Create: `scripts/foundry` (chmod +x)
- Create: `scripts/install-systemd-autostart.sh` (chmod +x)
- Create: `scripts/README.md` (full ops runbook — covers install, autostart, backup/restore, troubleshooting)

**`scripts/foundry`:**

```bash
#!/usr/bin/env bash
# foundry — one-stop ops CLI for the containerized stack.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker/docker-compose.yml"
BACKUP_DIR="${FOUNDRY_BACKUP_DIR:-$HOME/foundry-backups}"

# Auto-detect compose tool — podman compose (with podman-compose installed) preferred,
# falls back to docker compose
detect_compose() {
  if command -v podman-compose >/dev/null 2>&1; then
    echo "podman-compose"
  elif command -v podman >/dev/null 2>&1 && podman compose --help >/dev/null 2>&1; then
    echo "podman compose"
  elif command -v docker >/dev/null 2>&1; then
    echo "docker compose"
  else
    echo "no compose tool found (install podman-compose: sudo apt install podman-compose)" >&2
    exit 1
  fi
}
COMPOSE=$(detect_compose)

usage() {
  cat <<EOF
foundry — ops CLI for the containerized stack

USAGE
  scripts/foundry <command> [args]

COMMANDS
  up                Start all containers (build if needed)
  down              Stop and remove all containers
  restart           Stop, rebuild, and start all containers
  build             Build api and web images
  rebuild           Force-rebuild without cache
  logs [service]    Tail logs (all services if no arg)
  status            Show container status + healthchecks
  ps                Alias for status
  backup            Trigger an immediate backup (writes to FOUNDRY_BACKUP_DIR)
  list-backups      List backup files in FOUNDRY_BACKUP_DIR
  restore <file>    Restore from a backup file (DESTRUCTIVE — confirms first)
  shell [service]   Open a shell in a container (defaults to api)
  psql              Open psql against the postgres container as the superuser
  help              Show this message

ENVIRONMENT
  FOUNDRY_BACKUP_DIR  Where backups are stored on the host (default: ~/foundry-backups)
EOF
}

cmd_up() {
  mkdir -p "$BACKUP_DIR"
  echo "==> Bringing up foundry stack (compose: $COMPOSE)"
  $COMPOSE -f "$COMPOSE_FILE" up -d
  echo
  cmd_status
}

cmd_down() {
  $COMPOSE -f "$COMPOSE_FILE" down
}

cmd_restart() {
  echo "==> Restarting foundry stack"
  $COMPOSE -f "$COMPOSE_FILE" down
  cmd_build
  cmd_up
}

cmd_build() {
  echo "==> Building images"
  $COMPOSE -f "$COMPOSE_FILE" build
}

cmd_rebuild() {
  echo "==> Rebuilding images without cache"
  $COMPOSE -f "$COMPOSE_FILE" build --no-cache
}

cmd_logs() {
  local svc="${1:-}"
  if [ -n "$svc" ]; then
    $COMPOSE -f "$COMPOSE_FILE" logs -f --tail=100 "$svc"
  else
    $COMPOSE -f "$COMPOSE_FILE" logs -f --tail=50
  fi
}

cmd_status() {
  $COMPOSE -f "$COMPOSE_FILE" ps
  echo
  echo "==> Healthchecks"
  for c in foundry-postgres foundry-api foundry-web foundry-backup; do
    status=$(podman inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "not-running")
    printf "  %-20s %s\n" "$c" "$status"
  done
}

cmd_backup() {
  echo "==> Triggering immediate backup"
  podman exec foundry-backup /backup.sh
  echo "==> Latest backup files:"
  ls -lt "$BACKUP_DIR/daily" 2>/dev/null | head -5
}

cmd_list_backups() {
  echo "==> Backup directory: $BACKUP_DIR"
  for sub in daily weekly monthly last; do
    if [ -d "$BACKUP_DIR/$sub" ]; then
      echo
      echo "--- $sub ---"
      ls -lh "$BACKUP_DIR/$sub" 2>/dev/null || true
    fi
  done
}

cmd_restore() {
  local file="${1:-}"
  if [ -z "$file" ]; then
    echo "USAGE: scripts/foundry restore <backup-file>" >&2
    echo "(use 'scripts/foundry list-backups' to find candidates)" >&2
    exit 1
  fi
  if [ ! -f "$file" ]; then
    echo "ERROR: backup file not found: $file" >&2
    exit 1
  fi
  echo "WARNING: This will DROP and recreate the foundry database from $file"
  read -p "Type 'restore' to confirm: " confirm
  if [ "$confirm" != "restore" ]; then
    echo "aborted"
    exit 1
  fi
  echo "==> Stopping api + web to free DB connections"
  $COMPOSE -f "$COMPOSE_FILE" stop api web
  echo "==> Dropping and recreating database"
  podman exec foundry-postgres psql -U foundry -d postgres -c "DROP DATABASE IF EXISTS foundry;"
  podman exec foundry-postgres psql -U foundry -d postgres -c "CREATE DATABASE foundry OWNER foundry;"
  echo "==> Restoring from $file"
  if [[ "$file" == *.gz ]]; then
    gunzip -c "$file" | podman exec -i foundry-postgres psql -U foundry -d foundry
  else
    cat "$file" | podman exec -i foundry-postgres psql -U foundry -d foundry
  fi
  echo "==> Restarting api + web"
  $COMPOSE -f "$COMPOSE_FILE" start api web
  cmd_status
}

cmd_shell() {
  local svc="${1:-api}"
  podman exec -it "foundry-$svc" /bin/sh
}

cmd_psql() {
  podman exec -it foundry-postgres psql -U foundry -d foundry
}

main() {
  local cmd="${1:-help}"
  shift || true
  case "$cmd" in
    up)            cmd_up "$@" ;;
    down)          cmd_down "$@" ;;
    restart)       cmd_restart "$@" ;;
    build)         cmd_build "$@" ;;
    rebuild)       cmd_rebuild "$@" ;;
    logs)          cmd_logs "$@" ;;
    status|ps)     cmd_status "$@" ;;
    backup)        cmd_backup "$@" ;;
    list-backups)  cmd_list_backups "$@" ;;
    restore)       cmd_restore "$@" ;;
    shell)         cmd_shell "$@" ;;
    psql)          cmd_psql "$@" ;;
    help|--help|-h) usage ;;
    *)             echo "unknown command: $cmd" >&2; usage; exit 1 ;;
  esac
}

main "$@"
```

**`scripts/install-systemd-autostart.sh`:**

```bash
#!/usr/bin/env bash
# install-systemd-autostart.sh — enable foundry containers to start on system boot.
#
# This:
#   1. Enables lingering for the current user so user services run without an
#      active login session.
#   2. Enables podman-restart.service so containers with restart: unless-stopped
#      are automatically restarted on boot.
#
# After running this, the foundry stack will come up automatically on reboot
# (assuming you ran `scripts/foundry up` at least once to register the containers).

set -euo pipefail

USER_NAME="${USER:-$(whoami)}"

echo "==> User: $USER_NAME"
echo "==> Step 1/2: enable lingering (allows user services to run pre-login)"
if loginctl show-user "$USER_NAME" 2>/dev/null | grep -q '^Linger=yes'; then
  echo "    already enabled"
else
  echo "    requires sudo:"
  sudo loginctl enable-linger "$USER_NAME"
fi

echo "==> Step 2/2: enable + start podman-restart.service (user)"
systemctl --user enable --now podman-restart.service

echo
echo "==> Done. Verify with:"
echo "    loginctl show-user $USER_NAME | grep Linger"
echo "    systemctl --user status podman-restart.service"
echo
echo "Reboot to test: containers with restart: unless-stopped will come back up."
```

- [ ] **Step 1:** Write both scripts. `chmod +x` each.
- [ ] **Step 2:** Write the ops runbook (`scripts/README.md`). Cover:
  - Quick start (3 commands: clone, `cp .env.example .env`, `scripts/foundry up`)
  - The CLI's full command reference (subset of `scripts/foundry help` with examples)
  - Autostart setup (`sudo apt install podman-compose`, run `scripts/install-systemd-autostart.sh`, reboot to verify)
  - Backup mechanics (where files land, schedule, retention, what's stored)
  - Restore procedure (sample command + warning about destructive nature)
  - Troubleshooting (port conflicts, healthcheck failures, manual backup trigger, where logs live)
- [ ] **Step 3:** Commit:
  ```bash
  git add scripts/
  git commit -m "feat(ops): scripts/foundry CLI + systemd autostart installer + ops runbook

  scripts/foundry: single ops entrypoint with up/down/restart/build/logs/status/
  backup/list-backups/restore/shell/psql. Auto-detects podman-compose, podman
  compose, or docker compose at runtime.

  scripts/install-systemd-autostart.sh: one-shot enables loginctl linger +
  podman-restart.service so containers with restart: unless-stopped resume
  automatically on boot.

  scripts/README.md: ops runbook covering quick start, full CLI reference,
  autostart wiring, backup mechanics, restore procedure, and troubleshooting."
  ```

---

## Task 5: Bring up containerized stack + verify

**Pre-flight:** stop any running dev servers (`pkill -f 'tsx watch'` or use the bash session that started them).

- [ ] **Step 1:** Stop the dev servers from the demo:
  ```bash
  # If you ran `npm run dev --workspace @foundry/api` etc. earlier, kill them
  pkill -f 'tsx watch' || true
  pkill -f 'vite' || true
  sleep 1
  ss -tlnp 2>/dev/null | grep -E ':(5173|5380)' && echo "WARN ports still in use" || echo "ports clear"
  ```

- [ ] **Step 2:** Stop the existing postgres container if it conflicts (compose will manage it now):
  ```bash
  podman stop foundry-postgres 2>/dev/null || true
  podman rm foundry-postgres 2>/dev/null || true
  # NOTE: this only removes the container; the volume `foundry-pgdata` is preserved
  ```

- [ ] **Step 3:** Build the stack:
  ```bash
  ./scripts/foundry build
  ```
  Both `foundry-api:latest` and `foundry-web:latest` should build cleanly. Note any warnings.

- [ ] **Step 4:** Bring it up:
  ```bash
  ./scripts/foundry up
  ```
  All 4 services should reach `healthy` status (postgres, api, web) within ~30 seconds. The backup sidecar doesn't have a healthcheck but should be running.

- [ ] **Step 5:** Verify each surface:
  ```bash
  curl -sf http://localhost:5380/v1/healthz                   # {"status":"ok"}
  curl -sf http://localhost:5380/mcp/tools | head -c 200       # tool list
  curl -sf http://localhost:5173/ | head -c 100                # HTML
  curl -sf http://localhost:5173/v1/projects | head -c 200     # proxied through nginx
  ```

- [ ] **Step 6:** Verify migrations ran (the api container's entrypoint should have applied them — if it was a fresh DB):
  ```bash
  ./scripts/foundry psql -c "\dt project_*"
  ```
  Should list 5 tables.

- [ ] **Step 7:** Trigger a backup to confirm the sidecar works:
  ```bash
  ./scripts/foundry backup
  ./scripts/foundry list-backups
  ```
  Should produce a `foundry-<timestamp>.sql.gz` file in `~/foundry-backups/last/` (the sidecar writes "last" + daily/weekly/monthly).

- [ ] **Step 8:** Verify the data from the demo is still there (the volume `foundry-pgdata` should have persisted):
  ```bash
  curl -s http://localhost:5380/v1/projects | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'projects')"
  ```

- [ ] **Step 9:** Commit (if any tweaks were needed during verification):
  ```bash
  # No code changes expected; if there were, commit them with a "fix(docker): ..." message
  # Otherwise skip this step
  ```

---

## Task 6: Ops README + root README update

**Files:**
- Already covered by Task 4's `scripts/README.md`
- Modify: top-level `README.md` to mention the new ops surface

**Updated `README.md`** (just the additions — keep the rest):

Append a new section "Production-style local run":

```markdown
## Production-style local run

For "always on" use (so the dashboard is reachable any time you sit down), run the stack in containers:

```bash
cp .env.example .env   # if you haven't already
./scripts/foundry up
```

Visit http://localhost:5173. See `scripts/README.md` for the full ops runbook including autostart on boot, daily backups, and restore.

### Dev mode vs prod mode

- **Dev mode** (`npm run dev` per workspace): hot reload, source mounted, talks to the same Postgres on :5433. Use when actively coding.
- **Prod mode** (`./scripts/foundry up`): containers built once, immutable, restart-on-failure, daily backups. Use when you want the dashboard always available.

The two modes share the same Postgres database. You can run prod mode in the background and switch into dev mode for changes; just stop the prod `api` container so the port frees up: `./scripts/foundry down` (or `podman stop foundry-api foundry-web`).
```

- [ ] **Step 1:** Append the section to `README.md`.
- [ ] **Step 2:** Verify by reading the file.
- [ ] **Step 3:** Commit:
  ```bash
  git add README.md
  git commit -m "docs(readme): production-style local run + dev/prod mode distinction"
  ```

---

## Verification — Plan 4 complete

After Task 6:
- [ ] `./scripts/foundry status` shows all 4 services running + healthy
- [ ] http://localhost:5173 loads the dashboard
- [ ] `./scripts/foundry backup` produces a backup file
- [ ] `./scripts/foundry restart` recovers cleanly
- [ ] `scripts/install-systemd-autostart.sh` runs without error (user runs this manually)
- [ ] After reboot: containers come back up automatically (user verifies)

---

## What's NOT in Plan 4

- **CI/CD pipeline** — local-only; if you ever push images to a registry, that's separate work.
- **Offsite backup sync** — bring-your-own rclone or rsync. Backups are in `~/foundry-backups/`; cron `rsync` to wherever you like.
- **TLS / reverse proxy** — local stack only. Public exposure would need caddy/traefik in front.
- **Resource limits / quotas** — pod sizes left to defaults; tune via compose `deploy.resources` if needed.
- **Container vulnerability scanning** — manual `podman image trivy` if you care.
