# foundry

A CRUD app for registering and tracking Claude Code projects. Backend exposes a REST API; humans browse projects via a React frontend; an MCP server lets Claude Code agents register and update projects directly.

## Setup

```bash
nvm use                  # Node 22
npm install              # install workspace deps
cp .env.example .env     # configure DB URLs
./scripts/foundry up
```

## Production-style local run

For "always on" use (so the dashboard is reachable any time you sit down), run the stack in containers:

```bash
sudo apt install podman-compose  # one-time
cp .env.example .env             # one-time
./scripts/foundry up
```

Visit http://localhost:5173. See `scripts/README.md` for the full ops runbook: autostart on boot, daily backups, restore, troubleshooting.

### Dev mode vs prod mode

- **Dev mode** (`npm run dev` per workspace): hot reload, source-mounted, talks to the same Postgres on :5433. Use when actively coding.
- **Prod mode** (`./scripts/foundry up`): containers built once, immutable, restart-on-failure, daily backups to `~/foundry-backups/`. Use when you want the dashboard always available.

Both modes share the same Postgres database. Don't run them simultaneously — they'll fight for ports 5173 and 5380. `./scripts/foundry down` before switching to dev mode.

## Workspaces

- `packages/shared` — zod schemas, shared types
- `packages/db` — Drizzle schema, migrations, pg client
- `apps/api` — Fastify daemon (REST + MCP, see Plan 2)
- `apps/web` — Vite + React dashboard (Plan 3)

## Commands

| Action      | Command                                             |
| ----------- | --------------------------------------------------- |
| Test all    | `npm test`                                          |
| Lint        | `npm run lint`                                      |
| Format      | `npm run format`                                    |
| Stack up    | `./scripts/foundry up`                              |

See `docs/superpowers/specs/2026-05-16-foundry-design.md` for the full design.
