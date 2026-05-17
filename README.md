# foundry

A CRUD app for registering and tracking Claude Code projects. Backend exposes a REST API; humans browse projects via a React frontend; an MCP server lets Claude Code agents register and update projects directly.

## Setup

```bash
nvm use                  # Node 22
npm install              # install workspace deps
cp .env.example .env     # configure DB URLs
docker compose -f docker/docker-compose.yml up -d
```

## Workspaces

- `packages/shared` — zod schemas, shared types
- `packages/db` — Drizzle schema, migrations, pg client
- `apps/api` — Fastify daemon (REST + MCP, see Plan 2)
- `apps/web` — Vite + React dashboard (Plan 3)

## Commands

| Action | Command |
|---|---|
| Test all | `npm test` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Postgres up | `docker compose -f docker/docker-compose.yml up -d` |

See `docs/superpowers/specs/2026-05-16-foundry-design.md` for the full design.
