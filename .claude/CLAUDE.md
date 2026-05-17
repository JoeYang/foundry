# foundry

A CRUD app for registering and tracking Claude Code projects. Backend exposes a REST API; humans browse projects via a React frontend; a future MCP server will let Claude Code agents register and update their own projects directly.

## Commands

| Action | Command |
|---|---|
| Install | `npm install` |
| Dev (all apps) | `npm run dev` |
| Dev (web only) | `npm run dev -w apps/web` |
| Dev (api only) | `npm run dev -w apps/api` |
| Build | `npm run build` |
| Test | `npm test` |
| Test (single) | `npm test -- apps/api/src/routes/projects.test.ts` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| DB migrate | `npm run db:migrate` |
| DB studio | `npm run db:studio` |
| Docker up (Postgres) | `docker compose -f docker/docker-compose.yml up -d` |

## Architecture

Monorepo using npm workspaces.

- `apps/web/` — Vite + React frontend; talks to `apps/api` over REST
- `apps/api/` — Fastify HTTP server; project CRUD, search, vector queries
- `apps/mcp/` — (planned) MCP server exposing project-registration tools to Claude Code
- `packages/db/` — Drizzle schema, migrations, pg client (pgvector enabled)
- `packages/shared/` — zod schemas and types shared by web, api, and mcp
- `docker/` — local Postgres + pgvector via docker compose

## Working principles

- **Think first, code second.** Understand the full scope of the problem before writing any code. If anything is unclear or ambiguous, stop and ask — a clarifying question costs less than reworking a wrong implementation.
- **Less is more.** Simplify first. Prefer the smallest change that solves the problem. No speculative abstraction, no "while we're here" cleanup, no premature generalization.
- **Surgical changes.** Touch only what the task requires. Unrelated edits — formatting, renames, refactors — belong in their own commit, not folded into feature work.
- **Goal-driven execution.** Define the success criteria up front (what does "done" look like?), then work until those criteria are met. Stop when the goal is hit; don't drift into adjacent work. Restate the criteria before you claim completion.
- **TDD by default.** Write failing tests first, then implement until they pass. Bug fixes start with a regression test that reproduces the bug. See @.claude/rules/testing.md for the full workflow.

## Boundaries

### Always do
- Write failing tests first, then implement (TDD)
- Run `npm test` before reporting work complete
- Run `npm run format` before committing
- Run database migrations as their own commit, separate from feature code
- Create feature branches — never commit to main

### Ask first
- Adding new dependencies (root or any workspace)
- Schema changes in `packages/db/src/schema/`
- Changing the REST contract in `apps/api/src/routes/`
- Modifying `.env` keys or docker compose port mappings

### Never do
- Push to main or master
- Commit `.env`, secrets, or `*.local.*` files
- Disable or skip existing tests — fix them instead
- Hand-edit migration files after they've been applied locally

## Detailed rules

- @.claude/rules/typescript.md
- @.claude/rules/testing.md
- @.claude/rules/security.md
- @.claude/rules/api-design.md
- @.claude/rules/database.md
- @.claude/rules/frontend.md
- @.claude/rules/docker.md
