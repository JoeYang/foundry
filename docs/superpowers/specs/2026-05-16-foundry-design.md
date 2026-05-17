# Foundry — design spec

**Date:** 2026-05-16
**Status:** approved (brainstorming complete; not yet implemented)
**Scope:** v1 of the foundry app — local, single-user, on `joeyang`'s laptop.

## Purpose

Foundry is a personal project registry. Claude Code agents register the project they're working on and post structured updates (status, next step, decisions, todos, notes); the human owner browses a centralized dashboard to see all projects in one place and pick up where they left off after context switches.

Eventual surface: a long-lived MCP server reachable from any Claude Code session on the same machine, plus a web dashboard.

## Scope and non-goals

### In scope (v1)
- One Postgres database holding all project records and append-only history
- HTTP/SSE MCP server (`apps/mcp`) co-hosted with a REST API (`apps/api`) in a single Fastify daemon
- React dashboard (`apps/web`) — read-mostly, with a small surface of human-only flag toggles
- Append-only history for fields and aspects (events, decisions, todos, notes)
- In-memory liveness tracking with 30-min TTL
- Test discipline: real-Postgres integration tests, failure injection per category, all-paths coverage target

### Explicitly NOT in v1
- **Authentication / multi-user.** Localhost binding is the only barrier; trust model = "no untrusted process on this laptop".
- **Semantic search.** Embedding column is added now (`vector(1536)`) but no index, no embedding pipeline, no search endpoint.
- **Audit reconstruction / time-travel UI.** History tables exist and are queryable, but the dashboard only renders a flat recent timeline — no point-in-time replay.
- **Cross-machine / remote-agent support.** All actors trusted; transport is `127.0.0.1` only.
- **Conflict resolution beyond last-write-wins.** No `version` columns, no optimistic locking.
- **Sessions concept.** Events carry an `actor` string but are not grouped into a `session_id`.

## Architecture overview

```
                ┌────────────────────────────────────────────────────────┐
                │                  joeyang's laptop                       │
                │                                                         │
   ┌──────────┐ │   ┌────────────────┐   ┌────────────────┐              │
   │ Claude   │─MCP─│  apps/mcp      │   │  apps/web      │              │
   │ Code in  │     │  HTTP/SSE      │   │  Vite + React  │              │
   │ project  │     │  127.0.0.1     │   │  axiom-styled  │              │
   │  dir foo │     │  :5380/mcp     │   │  :5173         │              │
   └──────────┘     │  (Fastify)     │   └───────┬────────┘              │
                    │                 │           │ REST                   │
   ┌──────────┐    │  thin adapter   │           ▼                       │
   │ Claude   │─MCP┤  over REST      │   ┌────────────────┐              │
   │ Code in  │    │                 │   │  apps/api      │              │
   │ project  │    │                 │   │  Fastify       │              │
   │  dir bar │    │                 │   │  :5380/v1/*    │              │
   └──────────┘    └────────┬────────┘   └───────┬────────┘              │
                            │                    │                       │
                            │  in-process call   │                       │
                            ▼                    ▼                       │
                    ┌─────────────────────────────────────┐              │
                    │  packages/db (Drizzle)              │              │
                    │  pg pool · schema · migrations       │              │
                    └────────────────┬────────────────────┘              │
                                     │                                   │
                                     ▼                                   │
                    ┌─────────────────────────────────────┐              │
                    │  Postgres 16 + pgvector             │              │
                    │  (docker compose, :5433)            │              │
                    └─────────────────────────────────────┘              │
                                                                         │
                    ┌─────────────────────────────────────┐              │
                    │  packages/shared                     │              │
                    │  zod schemas (consumed by api +      │              │
                    │  mcp + web via generated TS types)   │              │
                    └─────────────────────────────────────┘              │
                └────────────────────────────────────────────────────────┘
```

**Workspace roles:**
- **`apps/api`** — the runtime daemon. Owns the Fastify server, route registration, dependency wiring, and process entry point. Imports `apps/mcp` as a library and mounts its routes at `/mcp`.
- **`apps/mcp`** — a *library* workspace that exports a Fastify plugin: the MCP tool registry, zod input schemas, and tool-to-handler bindings. Not its own daemon in v1 — but architected so it can become one without changing internal call sites (it would just need its own entry point and DI wiring).
- **`apps/web`** — Vite + React frontend, served separately at `:5173` in dev.
- **`packages/db`** — Drizzle schema, pg pool client, migrations.
- **`packages/shared`** — zod schemas and TypeScript types consumed by all three apps.

**Key architectural choices:**

| Choice | Why | Alt rejected |
|---|---|---|
| One Fastify process serves `/mcp` and `/v1/*` | One daemon, one port, shared pg pool, single source of truth for handlers | Two processes — doubles ops surface for a single-user local app |
| HTTP/SSE MCP transport | Long-lived daemon shares pool with REST; future-proof for remote use | stdio per-agent — fine for Claude Code default, but spawns N processes for N agents, no pooling |
| `apps/mcp` as a *library* (not a daemon) in v1 | Single deployable, but cleanly extractable later | apps/mcp as separate process — extra ops for no v1 benefit |
| Monorepo with npm workspaces | Shared types via `packages/shared`; MCP server extractable later | Single Next.js app — ties backend to React; harder to extract MCP |
| Drizzle ORM | TS-first, lighter than Prisma, better raw SQL escape hatch for pgvector | Prisma — pgvector still preview; Kysely — query builder only, no migration story |

## Data model

### Identity model

- **One filesystem directory = one project.** `projects.path` is the natural identity key (UNIQUE), `uuid` is the PK for stable external references.
- **Agents always pass `path`** on every call; server resolves `path → id`. No agent-side caching, no hidden `.foundry/` config file.
- **Dashboard uses `slug`** in URLs (derived from `name` on creation, also UNIQUE).

### Tables (5)

```
                ┌─────────────────────────────────┐
                │  projects (slim, current state) │
                │  id PK · path · slug · name      │
                │  summary · goal · status         │
                │  status_note · next_step         │
                │  tech_stack · links · metadata   │
                │  search_embedding                │
                │  pinned · archived · needs_review · user_notes │
                │  created_at · updated_at         │
                └───────────────┬─────────────────┘
                                │ 1:N (cascade delete)
        ┌───────────────────────┼────────────────────────┬─────────────────┐
        ▼                       ▼                        ▼                 ▼
┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ project_events   │  │ project_decisions   │  │ project_todos   │  │ project_notes    │
│ (change log)     │  │                     │  │                  │  │                  │
├──────────────────┤  ├─────────────────────┤  ├─────────────────┤  ├──────────────────┤
│ id PK            │  │ id PK                │  │ id PK            │  │ id PK            │
│ project_id FK    │  │ project_id FK        │  │ project_id FK    │  │ project_id FK    │
│ kind enum        │  │ title                │  │ text             │  │ body (md)        │
│ payload jsonb    │  │ rationale            │  │ status enum      │  │ author           │
│ actor            │  │ alternatives jsonb   │  │ added_at         │  │ created_at       │
│ occurred_at      │  │ decision jsonb       │  │ completed_at     │  │                  │
│                  │  │ superseded_by FK     │  │ added_by         │  │                  │
│                  │  │ made_at · made_by    │  │                  │  │                  │
└──────────────────┘  └─────────────────────┘  └─────────────────┘  └──────────────────┘
   APPEND-ONLY            APPEND-ONLY              first-class         APPEND-ONLY
                                                   (status mutable)
```

### Migrations

Two commits land the schema:

#### `0001_init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE project_status AS ENUM ('active','paused','blocked','done');

CREATE TABLE projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path              text NOT NULL UNIQUE,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  summary           text NOT NULL CHECK (length(summary) <= 280),
  goal              text NOT NULL DEFAULT '',
  status            project_status NOT NULL DEFAULT 'active',
  status_note       text,
  next_step         text,
  tech_stack        text[] NOT NULL DEFAULT '{}',
  links             jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_embedding  vector(1536),
  pinned            boolean NOT NULL DEFAULT false,
  archived          boolean NOT NULL DEFAULT false,
  needs_review      boolean NOT NULL DEFAULT false,
  user_notes        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_touch_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX projects_dashboard ON projects (archived, pinned DESC, updated_at DESC);
CREATE INDEX projects_status    ON projects (status) WHERE archived = false;
CREATE INDEX projects_name_trgm ON projects USING gin (name gin_trgm_ops);
-- Vector index deferred to v2 (semantic search):
-- CREATE INDEX projects_embedding ON projects USING hnsw (search_embedding vector_cosine_ops);
```

#### `0002_history.sql`

```sql
CREATE TYPE project_event_kind AS ENUM (
  'created','status_changed','next_step_changed','summary_changed',
  'goal_changed','links_changed','tech_stack_changed','human_flag_changed'
);

CREATE TABLE project_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        project_event_kind NOT NULL,
  payload     jsonb NOT NULL,
  actor       text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_events_timeline ON project_events (project_id, occurred_at DESC);
CREATE INDEX project_events_kind     ON project_events (kind, occurred_at DESC);

CREATE TABLE project_decisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  rationale     text NOT NULL,
  alternatives  jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision      jsonb NOT NULL DEFAULT '{}'::jsonb,
  superseded_by uuid REFERENCES project_decisions(id),
  made_at       timestamptz NOT NULL DEFAULT now(),
  made_by       text NOT NULL
);
CREATE INDEX project_decisions_project_time ON project_decisions (project_id, made_at DESC);
CREATE INDEX project_decisions_current      ON project_decisions (project_id)
  WHERE superseded_by IS NULL;

CREATE TYPE todo_status AS ENUM ('open','in_progress','done','cancelled');
CREATE TABLE project_todos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text          text NOT NULL,
  status        todo_status NOT NULL DEFAULT 'open',
  added_at      timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  added_by      text NOT NULL
);
CREATE INDEX project_todos_open ON project_todos (project_id, added_at DESC)
  WHERE status IN ('open','in_progress');

CREATE TABLE project_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body       text NOT NULL,
  author     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_notes_project_time ON project_notes (project_id, created_at DESC);
```

### Append-only invariant

Two layers of defense:

1. **Application code never issues `UPDATE` or `DELETE`** on `project_events`, `project_decisions`, or `project_notes`. (`project_todos.status` is the only mutable field on a history-style table — todos transition through their lifecycle.) Enforced by code review and a lint check.
2. **DB role permissions** — runtime role `foundry_app` has `INSERT, SELECT` on history tables but **no `UPDATE`, `DELETE`**. Schema migrations use a privileged role. A test asserts that direct `UPDATE project_events` as the app role fails with `permission denied`.

### Derived values (never stored)

```
live   = liveTracker.isLive(project.id)             (in-memory map; see Liveness section)
stale  = status = 'done' AND updated_at < now() - interval '90 days'
fossil = updated_at < now() - interval '365 days'
```

Decay is computed in the API handler that returns project listings; never written to a column.

### Write rule

Every PATCH on a tracked field of `projects` runs inside a single transaction that ALSO inserts a `project_events` row:

```
PATCH /v1/agent/projects/status {path, status: 'blocked', note: 'pg install'}
  BEGIN
  UPDATE projects SET status='blocked', status_note='pg install'  -- trigger touches updated_at
  INSERT project_events (kind='status_changed', payload={from:'active',to:'blocked',note:'pg install'}, actor='agent:claude-opus-4-7')
  COMMIT
  -- after commit: liveTracker.beat(project.id)
```

Aspect tables (decisions/todos/notes) do not write a parallel `project_events` row — their own append is the audit trail.

## API surface

### Agent-facing REST (`/v1/agent/*`, path-keyed)

| Verb | Path | Body | Notes |
|---|---|---|---|
| POST | `/v1/agent/projects/upsert` | `{path, name, summary, goal?, status?, status_note?, next_step?, tech_stack?, links?, metadata?, actor}` | Creates if `path` unseen; updates tracked fields otherwise. Writes events. |
| POST | `/v1/agent/projects/heartbeat` | `{path}` | Bumps in-memory liveness only. No DB write. |
| POST | `/v1/agent/projects/status` | `{path, status, note?, actor}` | Convenience over the upsert path. |
| POST | `/v1/agent/projects/next-step` | `{path, next_step, actor}` | Convenience. |
| POST | `/v1/agent/projects/decisions` | `{path, title, rationale, alternatives?, decision?, actor}` | Creates a decision. |
| POST | `/v1/agent/projects/decisions/supersede` | `{path, prior_id, title, rationale, alternatives?, decision?, actor}` | New decision + sets `prior.superseded_by`. |
| POST | `/v1/agent/projects/todos` | `{path, text, actor}` | Adds todo (status `open`). |
| PATCH | `/v1/agent/projects/todos/:id` | `{status}` | Sets `completed_at = now()` when `status = 'done'`. |
| POST | `/v1/agent/projects/notes` | `{path, body, author}` | Append markdown note. |
| POST | `/v1/agent/projects/get` | `{path}` | Returns project + last 10 events + open todos + current decisions + recent 5 notes. The "remind me where I am" call. |

### Human/dashboard REST (`/v1/*`, slug-keyed)

| Verb | Path | Notes |
|---|---|---|
| GET | `/v1/projects` | Query: `status?`, `search?`, `sort?`, `include_archived?`. Returns rows with derived `live`, `decay`. |
| GET | `/v1/projects/:slug` | Full project record (no children). |
| GET | `/v1/projects/:slug/timeline` | Unified stream: events + decisions + todos + notes, sorted desc. |
| GET | `/v1/projects/:slug/decisions` | All decisions, current + superseded. |
| GET | `/v1/projects/:slug/todos` | All todos, grouped by status. |
| GET | `/v1/projects/:slug/notes` | All notes, newest first. |
| PATCH | `/v1/projects/:slug/flags` | `{pinned?, archived?, needs_review?, user_notes?}`. Writes `human_flag_changed` event. |
| DELETE | `/v1/projects/:slug` | Hard delete (cascades). |

Plus operational: `GET /v1/healthz`, `GET /v1/livez`.

### MCP tool surface

1:1 with agent-facing REST. The MCP server is a thin Fastify route group at `/mcp` that:
1. Validates input against zod schemas in `packages/shared`.
2. Invokes the same in-process handler function as the REST route.
3. Returns the result.

| Tool | Underlying handler |
|---|---|
| `upsert_project` | `agentProjects.upsert` |
| `heartbeat` | `agentProjects.heartbeat` |
| `set_status` | `agentProjects.setStatus` |
| `set_next_step` | `agentProjects.setNextStep` |
| `add_decision` | `agentProjects.addDecision` |
| `supersede_decision` | `agentProjects.supersedeDecision` |
| `add_todo` | `agentProjects.addTodo` |
| `update_todo` | `agentProjects.updateTodo` |
| `add_note` | `agentProjects.addNote` |
| `get_project` | `agentProjects.get` |

### Error shape

```json
{"error": "VALIDATION_FAILED", "message": "summary exceeds 280 characters", "request_id": "..."}
```

Codes: `VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, `CAPACITY`, `INTERNAL`. Stack traces never leak.

### Actor identity convention

Trust the caller-declared `actor` string (single-user system). Convention:

| Caller | `actor` string |
|---|---|
| Claude Code (model known) | `agent:claude-opus-4-7`, `agent:claude-sonnet-4-6`, etc. |
| Claude Code (model unknown) | `agent:claude-code` |
| Other MCP clients | `agent:<client-name>` |
| Dashboard human flags | `human:joeyang` (hardcoded) |

## Frontend dashboard

### Visual language

Axiom design system (`/home/joeyang/.claude/skills/axiom-style`). Warm paper background `#fbfaf7`, single indigo accent `#3b4cad`, Source Serif 4 for display, Inter Tight for body, JetBrains Mono for tags. Flat cards with hairline borders. No emoji. No gradients.

### Routing (React Router v6)

| Path | Page |
|---|---|
| `/` | `DashboardPage` (status board card grid) |
| `/p/:slug` | `ProjectDetailPage` — Overview tab |
| `/p/:slug/timeline` | Timeline tab |
| `/p/:slug/decisions` | Decisions tab |
| `/p/:slug/todos` | Todos tab |
| `/p/:slug/notes` | Notes tab |

### Component tree

```
App
├─ TopBar              (brand + global search input + slug breadcrumb on detail)
├─ FilterBar           (status chips + sort) — only on /
├─ DashboardPage
│   ├─ PinnedSection         (cards where pinned=true)
│   └─ AllProjectsSection    (cards, sorted; decay rows pushed down)
│       └─ ProjectCard × N
└─ ProjectDetailPage
    ├─ DetailHeader          (name, live badge, status row, summary, goal, next-step block)
    ├─ TabBar                (Overview / Timeline / Decisions / Todos / Notes)
    ├─ OverviewBody          (current decisions, open todos, recent timeline)
    │   or TimelineBody / DecisionsBody / TodosBody / NotesBody
    └─ SideRail              (tech_stack, links, your-flags toggles, your-notes textarea, raw metadata)

Shared primitives:
  StatusDot, LiveBadge, DecayBadge, TechTag, Eyebrow, NextStepBlock, EmptyState
```

Visual mockups produced during brainstorming (under `.superpowers/brainstorm/` — gitignored, not part of the repo):
- `dashboard-axiom-v1.html` — card grid (list view): pinned section at top, then all projects; each card shows name, status with optional note, summary, "Next step" with hairline left rule, mono tech tags, footer with cwd path and relative update time. Filter chips across the top.
- `detail-axiom-v1.html` — project detail (Overview tab): header with name + live badge + status + goal + next-step block; tab bar; body with Current decisions, Open todos, Recent timeline; right rail with tech stack, links, your-flags toggles, your-notes textarea, raw metadata tags.

When implemented, these layouts are the visual specification — re-render in code to match.

### State management

- `@tanstack/react-query` is the only state layer. No Redux/Zustand.
- Cache keys: `['projects', {filter, sort}]`, `['project', slug]`, `['project', slug, 'timeline']`, etc.
- Dashboard list refetches every 10 s (picks up live-badge changes).
- Detail page refetches on tab change and window focus.
- The only mutations from the UI: `PATCH /v1/projects/:slug/flags` and `DELETE /v1/projects/:slug`. Both use optimistic updates.

### Filter / sort / search

- **Filter chips** (All / Active / Paused / Blocked / Done / Archived): client-side filter over the fetched list.
- **Sort** (`recently_updated` default, `name asc`, `last_heartbeat desc`): server-side via query params.
- **Search** input: debounced 200 ms, server-side via `pg_trgm` on `name + summary + path`.

### Empty / error states

- No projects ever: "No projects registered yet. From inside a project directory, ask Claude Code to call the `upsert_project` MCP tool on the foundry server."
- No filter results: "No projects match." with "Clear filters" affordance.
- API error: top banner — "Couldn't reach foundry API. Retry?" with react-query backoff.

## Liveness

### Storage

Liveness lives entirely in the backend process — **no DB column.**

```ts
// apps/api/src/services/live-tracker.ts
export class LiveTracker {
  private heartbeats = new Map<string, number>();         // project_id → epoch ms
  constructor(private ttlMs = 30 * 60 * 1000) {}          // 30-min default

  beat(projectId: string) { this.heartbeats.set(projectId, Date.now()); }

  isLive(projectId: string): boolean {
    const last = this.heartbeats.get(projectId);
    return last !== undefined && Date.now() - last < this.ttlMs;
  }

  evictExpired() {
    const cutoff = Date.now() - this.ttlMs * 2;
    for (const [id, ts] of this.heartbeats) if (ts < cutoff) this.heartbeats.delete(id);
  }
}
```

Eviction runs on `setInterval(5 min)` to bound the map.

### Call sites

- Every agent-facing endpoint calls `liveTracker.beat(project.id)` after its transaction commits.
- The `heartbeat({path})` tool: resolves `path → id` (one indexed SELECT), then `beat()`. No transaction, no event row. Sub-ms cost — hook-safe.
- `GET /v1/projects` and `GET /v1/projects/:slug` include `live: boolean` computed at read time.

### Configuration

`FOUNDRY_HEARTBEAT_TTL_SEC` env var (default `1800` = 30 min).

### Server restart

On restart the map empties. Every project shows `live: false` until the next agent call. Acceptable — restarts are rare, recovery is instant on the next heartbeat.

### Why 30-min TTL (and not 60 s)

If agents wire `heartbeat` into a Claude Code hook (stop / post-tool-use), the call fires often. With a Map cost and a long TTL:
- Hook-driven heartbeats are cheap (`Map.set` only).
- Liveness doesn't flicker off between bursts inside a session.
- "Live" reads as "engaged in the recent session window", which matches how the dashboard is actually used.

## Testing strategy

TDD throughout. Tests first, all paths covered, failure injection mandatory.

### Pyramid

```
                    e2e (Playwright)         5–10 tests, golden paths
                    ─────────────────
                integration (vitest)         bulk of tests
                REST + MCP + Drizzle,        real Postgres
                ─────────────────────
            unit (vitest)                    pure logic, fast
            zod · LiveTracker · slug · decay
```

### Test data

- Real Postgres on `:5433` (reuses `docker/docker-compose.yml`).
- Schema isolation per integration test file: `beforeAll` creates `test_${rand}` schema and runs migrations; `afterAll` drops it.
- `TRUNCATE ... CASCADE` between tests inside a file.
- No HTTP mocking inside the stack (MCP-tool tests call handlers directly; REST tests use Fastify `inject()`).
- `msw` for outbound HTTP mocking (only relevant once an embedding API is wired up).
- `vi.useFakeTimers()` + `vi.setSystemTime()` for LiveTracker and decay tests.

### Per-layer coverage

| Layer | What's tested |
|---|---|
| `packages/db` | Schema integrity, Drizzle queries, migration up/down round-trip, timeline UNION ordering |
| `packages/shared` | Zod schemas — valid inputs accepted, invalid inputs rejected with correct error codes |
| `apps/api` unit | `LiveTracker`, `slug()`, `decay()` |
| `apps/api` integration | Every REST handler, every MCP tool wrapper, append-only invariant (UPDATE on `project_events` as app role → permission denied) |
| `apps/web` unit | Components, react-query hooks (cache key correctness, error fallback UI) |
| `apps/web` e2e | Empty dashboard → mock upsert → list updates within polling interval; detail page tabs deep-link; flag toggle persists across refresh; search returns trgm matches |

### Failure injection (required categories)

| Category | Scenario | Asserted behavior |
|---|---|---|
| Network | API down on dashboard load | Banner shown; react-query retries; no crash |
| Network | API 500 on flag PATCH | Optimistic update reverts; toast surfaces error |
| Database | pg connection refused on app start | Process exits 1 with clear stderr |
| Database | `statement_timeout` exceeded | Handler returns 500; transaction rolled back |
| Database | Unique constraint race on `path` | `ON CONFLICT DO UPDATE` resolves; both callers receive 200 |
| Database | Deadlock on concurrent decision insert | Retry once; if still deadlocked, 500 with code |
| Inputs | Summary > 280 chars | 400 `VALIDATION_FAILED`; row not written |
| Inputs | Path with null bytes / odd unicode | Zod rejects with `INVALID_PATH` |
| Inputs | SQL injection in `name` | Stored as literal; assertion: `SELECT count(*)` unchanged |
| Concurrency | Two `upsert` same `path` simultaneously | Both 200; final state = later commit; events recorded |
| Concurrency | Two `heartbeat` 1 ms apart | Both succeed; map holds latest |
| Resource | Connection pool saturated | New request 503 `CAPACITY`; server doesn't crash |

### CI shape

- `npm test` runs unit + integration sequentially per workspace, parallel across workspaces. Requires the compose Postgres running locally.
- `npm run test:e2e` spins the stack via compose and runs Playwright.
- Pre-commit: **unit tests only** of any workspace whose files changed (fast, no docker dependency).
- Integration + e2e run in CI on every push.
- All-paths is the standard, not a percentage gate. Coverage report shown but not enforced numerically.

## Summary of rejected alternatives

| Topic | Rejected | Why |
|---|---|---|
| Identity model | User-chosen slug; auto UUID with local config file; git remote URL | Path is simpler, self-correcting, doesn't require agent-side state |
| Schema shape | Fully-structured fixed columns; fully-freeform JSON | Hybrid (structured core + JSONB metadata + first-class aspect tables) matches the "anything, but render predictably" need |
| Write model | Both agents and humans write structured fields | Conflict semantics burden; "humans flag only" is cleaner and matches actual use |
| MCP transport | stdio per-agent | One daemon shares pg pool; matches "single backend daemon" architecture |
| Heartbeat storage | `last_heartbeat_at` column on `projects` | DB churn on hooks; in-memory map is sub-ms and adequate for single daemon |
| Heartbeat TTL | 60 seconds | Too short for hook-driven heartbeats; "live" should mean "in the recent session window", not "executing this instant" |
| Dashboard layout | Dense table (Linear-style); Kanban by status | Card grid in axiom style is more readable for 5–15 projects |
| History approach | No history tables (just denormalized current state) | Loses audit; hybrid current-state + append-only events satisfies both |
| Sessions table | Group events by agent invocation | Out of scope for v1; actor string is enough |
| Auth | Bearer token per agent | Personal local app; localhost binding is sufficient |

## Implementation order (suggested commit sequence)

Each row is one commit, under 200 lines unless noted.

| # | Commit | Notes |
|---|---|---|
| 1 | `chore: scaffold monorepo (apps/{web,api,mcp}, packages/{db,shared})` | npm workspaces, tsconfig, eslint, prettier |
| 2 | `chore(docker): add docker compose with Postgres + pgvector` | named volume, port 5433, healthcheck |
| 3 | `feat(db): migration 0001_init — projects table` | matches DDL in this spec |
| 4 | `feat(db): migration 0002_history — events, decisions, todos, notes` | append-only invariant, DB role grants |
| 5 | `feat(shared): zod schemas for project + aspects + tool inputs` | source of truth for both api and mcp |
| 6 | `feat(api): liveTracker service + unit tests` | in-memory map, TTL config, eviction |
| 7 | `feat(api): agent upsert + status + next-step handlers + tests` | TDD; integration with real Postgres |
| 8 | `feat(api): agent decisions + supersede handlers + tests` | |
| 9 | `feat(api): agent todos + notes handlers + tests` | |
| 10 | `feat(api): agent get handler (the "remind me" call) + tests` | |
| 11 | `feat(api): human GET /v1/projects (list, derived live/decay) + tests` | |
| 12 | `feat(api): human GET /v1/projects/:slug + timeline + aspects + tests` | |
| 13 | `feat(api): PATCH /v1/projects/:slug/flags + DELETE + tests` | |
| 14 | `feat(mcp): apps/mcp library — tool registry + Fastify plugin + tests` | apps/api mounts it at `/mcp` |
| 15 | `feat(web): scaffold Vite + React + axiom CSS + React Router` | |
| 16 | `feat(web): DashboardPage + ProjectCard + FilterBar + tests` | |
| 17 | `feat(web): ProjectDetailPage + tabs + SideRail + tests` | |
| 18 | `feat(web): human flags panel (only writable UI surface) + tests` | |
| 19 | `chore(e2e): Playwright golden-path suite` | |
| 20 | `docs: README + docs/ files; .gitignore for .superpowers/ and node_modules` | |

## Future work (v2 and beyond)

- **Semantic search** (capability D from brainstorming): wire the existing `search_embedding vector(1536)` column up to an embedding pipeline; add hnsw index; add `GET /v1/search` endpoint and dashboard search results.
- **Audit / archaeology UI** (capability C): build a richer timeline view with grouping, diffs, and time-range filters. Schema already supports this.
- **Sessions concept:** group events by an agent-supplied `session_id` to enable "what happened in *this* invocation".
- **Bearer-token auth:** add when exposing beyond localhost.
- **SSE push for live updates:** swap the 10-s dashboard poll for `GET /v1/stream` server-sent events if the polling ever feels laggy.
- **Chunked embeddings:** if single-doc-per-project precision is insufficient, add a `project_chunks` table.
