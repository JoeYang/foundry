---
paths: ["packages/db/src/schema/**", "packages/db/src/migrations/**", "packages/db/drizzle.config.ts"]
---
# Database Rules (Postgres + pgvector + Drizzle)

## Migrations

- Generate migrations with `drizzle-kit generate` from schema changes; hand-write SQL only for things drizzle-kit can't express (e.g., `CREATE EXTENSION vector`, custom indexes)
- One migration per commit, never bundled with feature code
- Never modify a migration after it's been applied to any environment (local counts) — write a new migration to fix
- Migrations must be reversible — include a corresponding down step or document why a one-way migration is required
- Migration filenames are descriptive: `0003_add_projects_embedding_index.sql`, not `0003_changes.sql`

## Schema

- Every table has `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- Timestamps in UTC; convert at the presentation layer
- Prefer `not null` with explicit defaults over nullable columns
- Foreign keys with explicit `on delete` behavior — never rely on the default
- Indexes for every column used in `WHERE`, `JOIN`, or `ORDER BY`

## pgvector

- Embedding columns use `vector(N)` with N pinned to the embedding model's dimension
- Use `ivfflat` or `hnsw` indexes for similarity search; document the `lists` / `m` / `ef_construction` choice in the migration body
- Never run vector search without a `LIMIT` and a similarity threshold
- Re-embed and rebuild the index if the embedding model changes — never mix vectors from different models in one column

## Queries

- Use Drizzle's query builder; raw SQL only with parameterized `` sql`…` `` template literals
- Avoid N+1 — use Drizzle's relational queries or explicit joins
- Multi-step writes that must be atomic go in a transaction (`db.transaction(...)`)
- Every query has a `LIMIT` or pagination — no unbounded `SELECT *`

## Connections

- Use a single pooled `pg` client per process; never open a fresh connection per request
- Set `statement_timeout` on the connection to prevent runaway queries
- Tests close their connections explicitly; don't rely on process exit
