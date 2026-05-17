---
paths: ["docker/**", "Dockerfile", "**/Dockerfile", "compose.yaml", "docker-compose.yml", "**/docker-compose.yml"]
---
# Docker Rules

## Local dev

- Local Postgres + pgvector runs via `docker/docker-compose.yml`
- Compose file must:
  - Pin image tags (e.g., `pgvector/pgvector:pg16`) — never use `:latest`
  - Mount a named volume for `/var/lib/postgresql/data` so data survives container rebuilds
  - Expose Postgres on a non-default port (5433) to avoid clashing with a host install
  - Set `POSTGRES_PASSWORD` from `.env`, never inlined
- Health check on the Postgres service; apps depend on `service_healthy`, not just `service_started`

## Dockerfiles (when added)

- Multi-stage builds: a `builder` stage with full toolchain, a slim runtime stage
- Pin base images by digest or specific version, not `:latest`
- Run as a non-root user (`USER node` or explicit `useradd`)
- `.dockerignore` excludes `node_modules`, `.env*`, `.git`, `apps/**/dist`, `packages/**/dist`
- One process per container — no supervisord, no embedded Postgres

## Operations

- Never run `docker compose down -v` without confirming — it wipes the volume
- Never `docker system prune -a` on a shared machine
- Container logs are not the source of truth — they're for live debugging only
