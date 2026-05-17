# Foundry Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the foundry monorepo, dockerized Postgres+pgvector, two SQL migrations, shared zod schemas, a Drizzle client, and the `LiveTracker` service. After this plan, subsequent plans can build the backend handlers and frontend dashboard on top.

**Architecture:** npm workspaces monorepo. `packages/shared` is the single source of truth for runtime validation (zod) and compile-time types (TS). `packages/db` wraps Drizzle ORM and owns hand-written SQL migrations. `apps/api` ships the pure `LiveTracker` service (full server comes in Plan 2). Postgres+pgvector runs in Docker Compose. Migrations run as superuser; app runs as the restricted `foundry_app` role for DB-level append-only enforcement.

**Tech Stack:** TypeScript 5 · Node 22 · npm workspaces · Drizzle ORM 0.36+ · `node-postgres` (pg) · Postgres 16 + pgvector · zod 3 · vitest 2 · Docker Compose · pgvector/pgvector:pg16 image.

**Reference spec:** `docs/superpowers/specs/2026-05-16-foundry-design.md`

---

## File map

After this plan, the repo looks like:

```
foundry/
├── .gitignore
├── .nvmrc
├── .env.example
├── package.json                      ← root workspace manifest
├── tsconfig.base.json
├── .prettierrc.json
├── .eslintrc.cjs
├── README.md
├── docker/
│   ├── docker-compose.yml
│   └── init/
│       └── 01-roles.sql              ← creates foundry_app role on first DB boot
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── enums.ts
│   │   │   ├── project.ts
│   │   │   ├── decision.ts
│   │   │   ├── todo.ts
│   │   │   ├── note.ts
│   │   │   └── event.ts
│   │   └── tests/
│   │       ├── enums.test.ts
│   │       ├── project.test.ts
│   │       ├── decision.test.ts
│   │       ├── todo.test.ts
│   │       ├── note.test.ts
│   │       └── event.test.ts
│   └── db/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── drizzle.config.ts
│       ├── src/
│       │   ├── index.ts
│       │   ├── client.ts
│       │   └── schema/
│       │       ├── index.ts
│       │       ├── projects.ts
│       │       ├── events.ts
│       │       ├── decisions.ts
│       │       ├── todos.ts
│       │       └── notes.ts
│       ├── migrations/
│       │   ├── 0001_init.sql
│       │   └── 0002_history.sql
│       └── tests/
│           ├── helpers.ts
│           ├── migrations.test.ts
│           └── append-only.test.ts
└── apps/
    └── api/
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── src/
        │   └── services/
        │       └── live-tracker.ts
        └── tests/
            └── live-tracker.test.ts
```

---

## Task 1: Initialize git repo and root workspace config

**Files:**
- Create: `.gitignore`, `.nvmrc`, `package.json`, `tsconfig.base.json`, `.prettierrc.json`, `.eslintrc.cjs`, `README.md`, `.env.example`

- [ ] **Step 1: Initialize git in the project directory**

Run:
```bash
cd /home/joeyang/dev-tools/foundry && git init
```
Expected: `Initialized empty Git repository in /home/joeyang/dev-tools/foundry/.git/`

- [ ] **Step 2: Write `.gitignore`**

```gitignore
# Node
node_modules/
*.log
npm-debug.log*

# Build output
dist/
build/
*.tsbuildinfo

# Env
.env
.env.local
.env.*.local

# Coverage
coverage/

# IDE
.vscode/
.idea/

# OS
.DS_Store

# Brainstorming companion (transient mockups)
.superpowers/

# Docker volumes (named, but in case bind mount is used)
docker/data/
```

- [ ] **Step 3: Write `.nvmrc`**

```
22
```

- [ ] **Step 4: Write `package.json` (root)**

```json
{
  "name": "foundry",
  "private": true,
  "version": "0.0.0",
  "description": "Project registry for Claude Code agents to register and track local projects",
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "dev": "npm run dev --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 5: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 6: Write `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

- [ ] **Step 7: Write `.eslintrc.cjs`**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'node_modules/', '.superpowers/', '*.cjs'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

- [ ] **Step 8: Write `README.md`**

```markdown
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
```

- [ ] **Step 9: Write `.env.example`**

```
# Postgres connection for migrations (superuser)
DB_URL_MIGRATE=postgres://foundry:foundry@localhost:5433/foundry

# Postgres connection for the running app (restricted role, no UPDATE/DELETE on history tables)
DB_URL_APP=postgres://foundry_app:foundry_app@localhost:5433/foundry

# Liveness TTL in seconds (default 1800 = 30 min)
FOUNDRY_HEARTBEAT_TTL_SEC=1800
```

- [ ] **Step 10: Install root deps**

Run:
```bash
npm install
```
Expected: `node_modules/` populated; no errors. The `packages/*` and `apps/*` globs match nothing yet — that's fine.

- [ ] **Step 11: Commit**

```bash
git add .gitignore .nvmrc package.json tsconfig.base.json .prettierrc.json .eslintrc.cjs README.md .env.example package-lock.json
git commit -m "chore: initialize monorepo with npm workspaces

Sets up the root package.json with workspace globs for packages/* and
apps/*, shared TypeScript/eslint/prettier config, and the .env.example
documenting the two DB URL roles (migrate vs app)."
```

---

## Task 2: Docker Compose with Postgres + pgvector

**Files:**
- Create: `docker/docker-compose.yml`, `docker/init/01-roles.sql`

- [ ] **Step 1: Write `docker/docker-compose.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
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

volumes:
  foundry-pgdata:
    name: foundry-pgdata
```

- [ ] **Step 2: Write `docker/init/01-roles.sql`**

```sql
-- Runs once on first container boot (before any migration).
-- Creates the restricted runtime role; migration 0002 grants table-level access.
CREATE ROLE foundry_app WITH LOGIN PASSWORD 'foundry_app';
GRANT CONNECT ON DATABASE foundry TO foundry_app;
GRANT USAGE ON SCHEMA public TO foundry_app;
```

- [ ] **Step 3: Start the container**

Run:
```bash
docker compose -f docker/docker-compose.yml up -d
```
Expected: `[+] Running 2/2 ✔ Network ... ✔ Container foundry-postgres Started`.

- [ ] **Step 4: Wait for health and verify the role exists**

Run:
```bash
until docker exec foundry-postgres pg_isready -U foundry -d foundry; do sleep 1; done
docker exec foundry-postgres psql -U foundry -d foundry -c "\du foundry_app"
```
Expected: a row with `Role name: foundry_app` and `Attributes: (no superuser flags)`.

- [ ] **Step 5: Verify pgvector extension is available**

Run:
```bash
docker exec foundry-postgres psql -U foundry -d foundry -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname='vector';"
```
Expected: a single-column row showing the pgvector version (e.g., `0.7.4`).

- [ ] **Step 6: Commit**

```bash
git add docker/
git commit -m "chore(docker): add Postgres+pgvector compose with restricted runtime role

Compose file pins pgvector/pgvector:pg16, exposes Postgres on :5433 (avoids
clashing with host installs), and mounts docker/init/ as the entrypoint init
directory. 01-roles.sql creates the foundry_app role used at runtime; migration
0002 will grant it append-only-compatible table-level permissions."
```

---

## Task 3: packages/shared scaffold and enum schemas (TDD)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/enums.ts`, `packages/shared/tests/enums.test.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@foundry/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `packages/shared/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write `packages/shared/src/index.ts` (initial empty re-export)**

```typescript
export * from './enums.js';
```

- [ ] **Step 5: Install workspace deps**

Run:
```bash
npm install
```
Expected: `packages/shared/node_modules` symlinks; zod installed at root.

- [ ] **Step 6: Write the failing enum test**

Create `packages/shared/tests/enums.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  projectStatusSchema,
  todoStatusSchema,
  projectEventKindSchema,
  actorSchema,
  PROJECT_STATUSES,
  TODO_STATUSES,
  PROJECT_EVENT_KINDS,
} from '../src/enums.js';

describe('projectStatusSchema', () => {
  it.each(PROJECT_STATUSES)('accepts %s', (s) => {
    expect(projectStatusSchema.parse(s)).toBe(s);
  });
  it('rejects unknown values', () => {
    expect(() => projectStatusSchema.parse('archived')).toThrow();
    expect(() => projectStatusSchema.parse('')).toThrow();
    expect(() => projectStatusSchema.parse(null)).toThrow();
  });
});

describe('todoStatusSchema', () => {
  it.each(TODO_STATUSES)('accepts %s', (s) => {
    expect(todoStatusSchema.parse(s)).toBe(s);
  });
  it('rejects unknown values', () => {
    expect(() => todoStatusSchema.parse('todo')).toThrow();
  });
});

describe('projectEventKindSchema', () => {
  it.each(PROJECT_EVENT_KINDS)('accepts %s', (k) => {
    expect(projectEventKindSchema.parse(k)).toBe(k);
  });
  it('rejects unknown kinds', () => {
    expect(() => projectEventKindSchema.parse('todo_added')).toThrow();
  });
});

describe('actorSchema', () => {
  it.each([
    'agent:claude-opus-4-7',
    'agent:claude-sonnet-4-6',
    'agent:claude-code',
    'agent:custom-cli',
    'human:joeyang',
  ])('accepts %s', (a) => {
    expect(actorSchema.parse(a)).toBe(a);
  });
  it('requires agent: or human: prefix', () => {
    expect(() => actorSchema.parse('claude')).toThrow();
    expect(() => actorSchema.parse('bot:x')).toThrow();
    expect(() => actorSchema.parse('agent:')).toThrow();
    expect(() => actorSchema.parse('human:')).toThrow();
  });
});
```

- [ ] **Step 7: Run the test and verify failure**

Run:
```bash
npm test --workspace @foundry/shared
```
Expected: test discovery fails because `../src/enums.js` does not exist yet (or the imports fail).

- [ ] **Step 8: Implement `packages/shared/src/enums.ts`**

```typescript
import { z } from 'zod';

export const PROJECT_STATUSES = ['active', 'paused', 'blocked', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const projectStatusSchema = z.enum(PROJECT_STATUSES);

export const TODO_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];
export const todoStatusSchema = z.enum(TODO_STATUSES);

export const PROJECT_EVENT_KINDS = [
  'created',
  'status_changed',
  'next_step_changed',
  'summary_changed',
  'goal_changed',
  'links_changed',
  'tech_stack_changed',
  'human_flag_changed',
] as const;
export type ProjectEventKind = (typeof PROJECT_EVENT_KINDS)[number];
export const projectEventKindSchema = z.enum(PROJECT_EVENT_KINDS);

// actor strings must be 'agent:<name>' or 'human:<name>' with a non-empty name
export const actorSchema = z
  .string()
  .regex(/^(agent|human):.+$/, 'actor must be "agent:<name>" or "human:<name>"');
export type Actor = z.infer<typeof actorSchema>;
```

- [ ] **Step 9: Run the test and verify it passes**

Run:
```bash
npm test --workspace @foundry/shared
```
Expected: all enum tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): zod enums for status, todo state, event kind, actor

Establishes the four enum schemas used everywhere — project lifecycle
(active/paused/blocked/done), todo lifecycle (open/in_progress/done/cancelled),
event kinds for the append-only log, and the agent:/human: actor convention."
```

---

## Task 4: packages/shared project schemas (TDD)

**Files:**
- Create: `packages/shared/src/project.ts`, `packages/shared/tests/project.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing project-schema test**

Create `packages/shared/tests/project.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  upsertProjectInputSchema,
  setStatusInputSchema,
  setNextStepInputSchema,
  patchFlagsInputSchema,
  projectSchema,
  derivedProjectSchema,
} from '../src/project.js';

describe('upsertProjectInputSchema', () => {
  it('accepts minimal valid input', () => {
    const parsed = upsertProjectInputSchema.parse({
      path: '/home/joeyang/dev/foundry',
      name: 'foundry',
      summary: 'Project registry MCP',
      actor: 'agent:claude-opus-4-7',
    });
    expect(parsed.path).toBe('/home/joeyang/dev/foundry');
  });

  it('rejects summary > 280 chars', () => {
    expect(() =>
      upsertProjectInputSchema.parse({
        path: '/x',
        name: 'x',
        summary: 'a'.repeat(281),
        actor: 'agent:claude',
      }),
    ).toThrow();
  });

  it('rejects empty path', () => {
    expect(() =>
      upsertProjectInputSchema.parse({
        path: '',
        name: 'x',
        summary: 'y',
        actor: 'agent:claude',
      }),
    ).toThrow();
  });

  it('rejects path with null bytes', () => {
    expect(() =>
      upsertProjectInputSchema.parse({
        path: '/foo\x00bar',
        name: 'x',
        summary: 'y',
        actor: 'agent:claude',
      }),
    ).toThrow();
  });

  it('accepts paths with spaces (valid on Linux/macOS)', () => {
    expect(
      upsertProjectInputSchema.parse({
        path: '/home/joeyang/My Documents/foo',
        name: 'foo',
        summary: 's',
        actor: 'agent:claude',
      }),
    ).toBeDefined();
  });

  it('rejects missing actor', () => {
    expect(() =>
      upsertProjectInputSchema.parse({ path: '/x', name: 'x', summary: 'y' }),
    ).toThrow();
  });

  it('accepts optional fields', () => {
    const parsed = upsertProjectInputSchema.parse({
      path: '/x',
      name: 'x',
      summary: 'y',
      actor: 'agent:claude',
      goal: 'do the thing',
      status: 'blocked',
      status_note: 'waiting on pg',
      next_step: 'install postgres',
      tech_stack: ['ts', 'pg'],
      links: { repo: 'https://github.com/x/y' },
      metadata: { foo: 'bar' },
    });
    expect(parsed.status).toBe('blocked');
    expect(parsed.tech_stack).toEqual(['ts', 'pg']);
  });
});

describe('setStatusInputSchema', () => {
  it('requires path + status + actor', () => {
    expect(setStatusInputSchema.parse({ path: '/x', status: 'done', actor: 'agent:c' })).toBeDefined();
    expect(() => setStatusInputSchema.parse({ path: '/x', actor: 'agent:c' })).toThrow();
  });
  it('accepts optional note', () => {
    const parsed = setStatusInputSchema.parse({
      path: '/x',
      status: 'blocked',
      note: 'pg crashed',
      actor: 'agent:c',
    });
    expect(parsed.note).toBe('pg crashed');
  });
});

describe('setNextStepInputSchema', () => {
  it('requires path + next_step + actor', () => {
    expect(
      setNextStepInputSchema.parse({ path: '/x', next_step: 'run tests', actor: 'agent:c' }),
    ).toBeDefined();
    expect(() => setNextStepInputSchema.parse({ path: '/x', actor: 'agent:c' })).toThrow();
  });
});

describe('patchFlagsInputSchema', () => {
  it('accepts any subset of flags', () => {
    expect(patchFlagsInputSchema.parse({ pinned: true })).toEqual({ pinned: true });
    expect(patchFlagsInputSchema.parse({ archived: false, needs_review: true })).toBeDefined();
    expect(patchFlagsInputSchema.parse({ user_notes: 'hello' })).toBeDefined();
  });
  it('accepts empty object (no-op)', () => {
    expect(patchFlagsInputSchema.parse({})).toEqual({});
  });
});

describe('projectSchema', () => {
  it('parses a full project row shape', () => {
    const parsed = projectSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      path: '/x',
      slug: 'foundry',
      name: 'foundry',
      summary: 's',
      goal: '',
      status: 'active',
      status_note: null,
      next_step: null,
      tech_stack: [],
      links: {},
      metadata: {},
      search_embedding: null,
      pinned: false,
      archived: false,
      needs_review: false,
      user_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(parsed.slug).toBe('foundry');
  });
});

describe('derivedProjectSchema', () => {
  it('extends projectSchema with live + decay', () => {
    const parsed = derivedProjectSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      path: '/x',
      slug: 'x',
      name: 'x',
      summary: 's',
      goal: '',
      status: 'done',
      status_note: null,
      next_step: null,
      tech_stack: [],
      links: {},
      metadata: {},
      search_embedding: null,
      pinned: false,
      archived: false,
      needs_review: false,
      user_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      live: false,
      decay: 'fresh',
    });
    expect(parsed.decay).toBe('fresh');
  });
  it.each(['fresh', 'stale', 'fossil'] as const)('accepts decay=%s', (d) => {
    const base = {
      id: '00000000-0000-0000-0000-000000000001',
      path: '/x',
      slug: 'x',
      name: 'x',
      summary: 's',
      goal: '',
      status: 'active' as const,
      status_note: null,
      next_step: null,
      tech_stack: [],
      links: {},
      metadata: {},
      search_embedding: null,
      pinned: false,
      archived: false,
      needs_review: false,
      user_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      live: true,
      decay: d,
    };
    expect(derivedProjectSchema.parse(base).decay).toBe(d);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:
```bash
npm test --workspace @foundry/shared
```
Expected: failures because `../src/project.js` doesn't exist.

- [ ] **Step 3: Implement `packages/shared/src/project.ts`**

```typescript
import { z } from 'zod';
import { projectStatusSchema, actorSchema } from './enums.js';

// Path: non-empty, no null bytes (Postgres text columns reject \x00)
const pathSchema = z
  .string()
  .min(1, 'path required')
  .refine((s) => !s.includes('\x00'), 'path must not contain null bytes');

const summarySchema = z.string().max(280, 'summary must be ≤ 280 characters');

const linksSchema = z.record(z.string(), z.string().url()).default({});
const metadataSchema = z.record(z.string(), z.unknown()).default({});

export const upsertProjectInputSchema = z.object({
  path: pathSchema,
  name: z.string().min(1),
  summary: summarySchema,
  goal: z.string().default(''),
  status: projectStatusSchema.optional(),
  status_note: z.string().nullable().optional(),
  next_step: z.string().nullable().optional(),
  tech_stack: z.array(z.string()).default([]),
  links: linksSchema,
  metadata: metadataSchema,
  actor: actorSchema,
});
export type UpsertProjectInput = z.infer<typeof upsertProjectInputSchema>;

export const setStatusInputSchema = z.object({
  path: pathSchema,
  status: projectStatusSchema,
  note: z.string().nullable().optional(),
  actor: actorSchema,
});
export type SetStatusInput = z.infer<typeof setStatusInputSchema>;

export const setNextStepInputSchema = z.object({
  path: pathSchema,
  next_step: z.string(),
  actor: actorSchema,
});
export type SetNextStepInput = z.infer<typeof setNextStepInputSchema>;

export const patchFlagsInputSchema = z.object({
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  needs_review: z.boolean().optional(),
  user_notes: z.string().nullable().optional(),
});
export type PatchFlagsInput = z.infer<typeof patchFlagsInputSchema>;

// Embedding column is vector(1536); represented in JSON as a number[] of length 1536 or null
const embeddingSchema = z.array(z.number()).length(1536).nullable();

export const projectSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  goal: z.string(),
  status: projectStatusSchema,
  status_note: z.string().nullable(),
  next_step: z.string().nullable(),
  tech_stack: z.array(z.string()),
  links: z.record(z.string(), z.string()),
  metadata: z.record(z.string(), z.unknown()),
  search_embedding: embeddingSchema,
  pinned: z.boolean(),
  archived: z.boolean(),
  needs_review: z.boolean(),
  user_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const decaySchema = z.enum(['fresh', 'stale', 'fossil']);
export type Decay = z.infer<typeof decaySchema>;

export const derivedProjectSchema = projectSchema.extend({
  live: z.boolean(),
  decay: decaySchema,
});
export type DerivedProject = z.infer<typeof derivedProjectSchema>;
```

- [ ] **Step 4: Update `packages/shared/src/index.ts`**

```typescript
export * from './enums.js';
export * from './project.js';
```

- [ ] **Step 5: Run the test and verify it passes**

Run:
```bash
npm test --workspace @foundry/shared
```
Expected: all project tests pass alongside the enum tests.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/project.ts packages/shared/src/index.ts packages/shared/tests/project.test.ts
git commit -m "feat(shared): zod schemas for project upsert, status, flags, and the row shape

Defines UpsertProjectInput (the primary agent write surface), SetStatusInput
and SetNextStepInput convenience inputs, PatchFlagsInput for the dashboard's
only writable surface, and projectSchema/derivedProjectSchema for response
validation. Path validation rejects null bytes; summary capped at 280 chars."
```

---

## Task 5: packages/shared decision, todo, note, event schemas (TDD)

**Files:**
- Create: `packages/shared/src/decision.ts`, `packages/shared/src/todo.ts`, `packages/shared/src/note.ts`, `packages/shared/src/event.ts`, plus four test files
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/tests/decision.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  addDecisionInputSchema,
  supersedeDecisionInputSchema,
  decisionSchema,
} from '../src/decision.js';

describe('addDecisionInputSchema', () => {
  it('accepts minimal input', () => {
    expect(
      addDecisionInputSchema.parse({
        path: '/x',
        title: 'Use Drizzle',
        rationale: 'Lighter than Prisma',
        actor: 'agent:claude',
      }),
    ).toBeDefined();
  });
  it('rejects empty title', () => {
    expect(() =>
      addDecisionInputSchema.parse({
        path: '/x',
        title: '',
        rationale: 'r',
        actor: 'agent:c',
      }),
    ).toThrow();
  });
  it('accepts alternatives + decision payloads', () => {
    const parsed = addDecisionInputSchema.parse({
      path: '/x',
      title: 't',
      rationale: 'r',
      alternatives: [{ label: 'Prisma', why_rejected: 'preview support' }],
      decision: { confidence: 'high', revisit_by: '2026-12-01' },
      actor: 'agent:c',
    });
    expect(parsed.alternatives?.[0]?.label).toBe('Prisma');
  });
});

describe('supersedeDecisionInputSchema', () => {
  it('requires prior_id', () => {
    expect(
      supersedeDecisionInputSchema.parse({
        path: '/x',
        prior_id: '00000000-0000-0000-0000-000000000001',
        title: 't',
        rationale: 'r',
        actor: 'agent:c',
      }),
    ).toBeDefined();
    expect(() =>
      supersedeDecisionInputSchema.parse({
        path: '/x',
        title: 't',
        rationale: 'r',
        actor: 'agent:c',
      }),
    ).toThrow();
  });
});

describe('decisionSchema', () => {
  it('parses a full row', () => {
    const row = decisionSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      project_id: '00000000-0000-0000-0000-000000000002',
      title: 't',
      rationale: 'r',
      alternatives: [],
      decision: {},
      superseded_by: null,
      made_at: new Date().toISOString(),
      made_by: 'agent:claude',
    });
    expect(row.superseded_by).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `packages/shared/src/decision.ts`**

```typescript
import { z } from 'zod';
import { actorSchema } from './enums.js';

const pathSchema = z.string().min(1);

export const alternativeSchema = z.object({
  label: z.string().min(1),
  why_rejected: z.string().optional(),
});

export const decisionPayloadSchema = z
  .object({
    chosen: z.string().optional(),
    options_considered: z.array(z.string()).optional(),
    confidence: z.enum(['low', 'med', 'high']).optional(),
    revisit_by: z.string().optional(),
    tags: z.array(z.string()).optional(),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
    related_decision_ids: z.array(z.string().uuid()).optional(),
  })
  .catchall(z.unknown());

export const addDecisionInputSchema = z.object({
  path: pathSchema,
  title: z.string().min(1),
  rationale: z.string().min(1),
  alternatives: z.array(alternativeSchema).optional(),
  decision: decisionPayloadSchema.optional(),
  actor: actorSchema,
});
export type AddDecisionInput = z.infer<typeof addDecisionInputSchema>;

export const supersedeDecisionInputSchema = addDecisionInputSchema.extend({
  prior_id: z.string().uuid(),
});
export type SupersedeDecisionInput = z.infer<typeof supersedeDecisionInputSchema>;

export const decisionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string(),
  rationale: z.string(),
  alternatives: z.array(alternativeSchema),
  decision: z.record(z.string(), z.unknown()),
  superseded_by: z.string().uuid().nullable(),
  made_at: z.string(),
  made_by: z.string(),
});
export type Decision = z.infer<typeof decisionSchema>;
```

- [ ] **Step 3: Write `packages/shared/tests/todo.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  addTodoInputSchema,
  updateTodoInputSchema,
  todoSchema,
} from '../src/todo.js';

describe('addTodoInputSchema', () => {
  it('accepts path + text + actor', () => {
    expect(
      addTodoInputSchema.parse({ path: '/x', text: 'do thing', actor: 'agent:c' }),
    ).toBeDefined();
  });
  it('rejects empty text', () => {
    expect(() =>
      addTodoInputSchema.parse({ path: '/x', text: '', actor: 'agent:c' }),
    ).toThrow();
  });
});

describe('updateTodoInputSchema', () => {
  it('requires status', () => {
    expect(updateTodoInputSchema.parse({ status: 'done' })).toEqual({ status: 'done' });
    expect(() => updateTodoInputSchema.parse({})).toThrow();
  });
  it('rejects unknown status', () => {
    expect(() => updateTodoInputSchema.parse({ status: 'maybe' })).toThrow();
  });
});

describe('todoSchema', () => {
  it('parses a full row', () => {
    expect(
      todoSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        project_id: '00000000-0000-0000-0000-000000000002',
        text: 'do thing',
        status: 'open',
        added_at: new Date().toISOString(),
        completed_at: null,
        added_by: 'agent:c',
      }),
    ).toBeDefined();
  });
});
```

- [ ] **Step 4: Implement `packages/shared/src/todo.ts`**

```typescript
import { z } from 'zod';
import { actorSchema, todoStatusSchema } from './enums.js';

const pathSchema = z.string().min(1);

export const addTodoInputSchema = z.object({
  path: pathSchema,
  text: z.string().min(1),
  actor: actorSchema,
});
export type AddTodoInput = z.infer<typeof addTodoInputSchema>;

export const updateTodoInputSchema = z.object({
  status: todoStatusSchema,
});
export type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;

export const todoSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  text: z.string(),
  status: todoStatusSchema,
  added_at: z.string(),
  completed_at: z.string().nullable(),
  added_by: z.string(),
});
export type Todo = z.infer<typeof todoSchema>;
```

- [ ] **Step 5: Write `packages/shared/tests/note.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { addNoteInputSchema, noteSchema } from '../src/note.js';

describe('addNoteInputSchema', () => {
  it('accepts path + body + author', () => {
    expect(
      addNoteInputSchema.parse({ path: '/x', body: 'hello', author: 'agent:c' }),
    ).toBeDefined();
  });
  it('rejects empty body', () => {
    expect(() =>
      addNoteInputSchema.parse({ path: '/x', body: '', author: 'agent:c' }),
    ).toThrow();
  });
  it('requires author with agent:/human: prefix', () => {
    expect(() =>
      addNoteInputSchema.parse({ path: '/x', body: 'b', author: 'bob' }),
    ).toThrow();
  });
});

describe('noteSchema', () => {
  it('parses a full row', () => {
    expect(
      noteSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        project_id: '00000000-0000-0000-0000-000000000002',
        body: 'b',
        author: 'human:joeyang',
        created_at: new Date().toISOString(),
      }),
    ).toBeDefined();
  });
});
```

- [ ] **Step 6: Implement `packages/shared/src/note.ts`**

```typescript
import { z } from 'zod';
import { actorSchema } from './enums.js';

const pathSchema = z.string().min(1);

export const addNoteInputSchema = z.object({
  path: pathSchema,
  body: z.string().min(1),
  author: actorSchema,
});
export type AddNoteInput = z.infer<typeof addNoteInputSchema>;

export const noteSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  body: z.string(),
  author: z.string(),
  created_at: z.string(),
});
export type Note = z.infer<typeof noteSchema>;
```

- [ ] **Step 7: Write `packages/shared/tests/event.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { eventSchema, eventPayloadSchemas } from '../src/event.js';

describe('eventSchema', () => {
  it('parses a status_changed event', () => {
    const row = eventSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      project_id: '00000000-0000-0000-0000-000000000002',
      kind: 'status_changed',
      payload: { from: 'active', to: 'blocked', note: 'pg crashed' },
      actor: 'agent:claude',
      occurred_at: new Date().toISOString(),
    });
    expect(row.kind).toBe('status_changed');
  });
});

describe('eventPayloadSchemas', () => {
  it('validates status_changed payload', () => {
    expect(
      eventPayloadSchemas.status_changed.parse({ from: 'active', to: 'done', note: null }),
    ).toBeDefined();
    expect(() =>
      eventPayloadSchemas.status_changed.parse({ from: 'active' }),
    ).toThrow();
  });
  it('validates next_step_changed payload', () => {
    expect(
      eventPayloadSchemas.next_step_changed.parse({ from: null, to: 'ship v1' }),
    ).toBeDefined();
  });
  it('validates created payload (empty)', () => {
    expect(eventPayloadSchemas.created.parse({})).toBeDefined();
  });
});
```

- [ ] **Step 8: Implement `packages/shared/src/event.ts`**

```typescript
import { z } from 'zod';
import { projectStatusSchema, projectEventKindSchema } from './enums.js';

const fromToString = z.object({ from: z.string().nullable(), to: z.string() });
const fromToStringArray = z.object({
  from: z.array(z.string()),
  to: z.array(z.string()),
});
const fromToRecord = z.object({
  from: z.record(z.string(), z.unknown()),
  to: z.record(z.string(), z.unknown()),
});

export const eventPayloadSchemas = {
  created: z.object({}).strict(),
  status_changed: z.object({
    from: projectStatusSchema,
    to: projectStatusSchema,
    note: z.string().nullable().optional(),
  }),
  next_step_changed: fromToString.extend({ from: z.string().nullable() }),
  summary_changed: fromToString.extend({ from: z.string().nullable() }),
  goal_changed: fromToString.extend({ from: z.string().nullable() }),
  links_changed: fromToRecord,
  tech_stack_changed: fromToStringArray,
  human_flag_changed: z.object({
    flag: z.enum(['pinned', 'archived', 'needs_review', 'user_notes']),
    from: z.union([z.boolean(), z.string(), z.null()]),
    to: z.union([z.boolean(), z.string(), z.null()]),
  }),
} as const;

export const eventSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  kind: projectEventKindSchema,
  payload: z.record(z.string(), z.unknown()),
  actor: z.string(),
  occurred_at: z.string(),
});
export type ProjectEvent = z.infer<typeof eventSchema>;
```

- [ ] **Step 9: Update `packages/shared/src/index.ts`**

```typescript
export * from './enums.js';
export * from './project.js';
export * from './decision.js';
export * from './todo.js';
export * from './note.js';
export * from './event.js';
```

- [ ] **Step 10: Run all shared tests**

Run:
```bash
npm test --workspace @foundry/shared
```
Expected: all enum, project, decision, todo, note, and event tests pass.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/decision.ts packages/shared/src/todo.ts packages/shared/src/note.ts packages/shared/src/event.ts packages/shared/src/index.ts packages/shared/tests/decision.test.ts packages/shared/tests/todo.test.ts packages/shared/tests/note.test.ts packages/shared/tests/event.test.ts
git commit -m "feat(shared): zod schemas for decisions, todos, notes, and events

Covers AddDecisionInput + SupersedeDecisionInput (with alternative and
decision-payload sub-schemas), AddTodoInput + UpdateTodoInput, AddNoteInput,
and a per-kind eventPayloadSchemas map for type-safe parsing of the
generic project_events.payload jsonb column."
```

---

## Task 6: packages/db scaffold and Drizzle schema files

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/vitest.config.ts`, `packages/db/drizzle.config.ts`, `packages/db/src/index.ts`, `packages/db/src/schema/*.ts` (6 files)

- [ ] **Step 1: Write `packages/db/package.json`**

```json
{
  "name": "@foundry/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "migrate": "node --import tsx ./src/scripts/migrate.ts"
  },
  "dependencies": {
    "@foundry/shared": "*",
    "drizzle-orm": "^0.36.0",
    "pg": "^8.13.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `packages/db/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15000,
  },
});
```

- [ ] **Step 4: Write `packages/db/drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URL_MIGRATE ?? 'postgres://foundry:foundry@localhost:5433/foundry',
  },
} satisfies Config;
```

- [ ] **Step 5: Write `packages/db/src/schema/projects.ts`**

```typescript
import { pgTable, uuid, text, pgEnum, timestamp, boolean, jsonb, check, index, vector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const projectStatusEnum = pgEnum('project_status', ['active', 'paused', 'blocked', 'done']);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    path: text('path').notNull().unique(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    summary: text('summary').notNull(),
    goal: text('goal').notNull().default(''),
    status: projectStatusEnum('status').notNull().default('active'),
    status_note: text('status_note'),
    next_step: text('next_step'),
    tech_stack: text('tech_stack').array().notNull().default(sql`'{}'::text[]`),
    links: jsonb('links').notNull().default(sql`'{}'::jsonb`),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    search_embedding: vector('search_embedding', { dimensions: 1536 }),
    pinned: boolean('pinned').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    needs_review: boolean('needs_review').notNull().default(false),
    user_notes: text('user_notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('summary_length', sql`length(${t.summary}) <= 280`),
    index('projects_dashboard').on(t.archived, t.pinned.desc(), t.updated_at.desc()),
    index('projects_status').on(t.status).where(sql`archived = false`),
    index('projects_name_trgm').using('gin', sql`${t.name} gin_trgm_ops`),
  ],
);
```

- [ ] **Step 6: Write `packages/db/src/schema/events.ts`**

```typescript
import { pgTable, uuid, text, pgEnum, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectEventKindEnum = pgEnum('project_event_kind', [
  'created',
  'status_changed',
  'next_step_changed',
  'summary_changed',
  'goal_changed',
  'links_changed',
  'tech_stack_changed',
  'human_flag_changed',
]);

export const projectEvents = pgTable(
  'project_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: projectEventKindEnum('kind').notNull(),
    payload: jsonb('payload').notNull(),
    actor: text('actor').notNull(),
    occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('project_events_timeline').on(t.project_id, t.occurred_at.desc()),
    index('project_events_kind').on(t.kind, t.occurred_at.desc()),
  ],
);
```

- [ ] **Step 7: Write `packages/db/src/schema/decisions.ts`**

```typescript
import { pgTable, uuid, text, timestamp, jsonb, index, AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects.js';

export const projectDecisions = pgTable(
  'project_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    rationale: text('rationale').notNull(),
    alternatives: jsonb('alternatives').notNull().default(sql`'[]'::jsonb`),
    decision: jsonb('decision').notNull().default(sql`'{}'::jsonb`),
    superseded_by: uuid('superseded_by').references((): AnyPgColumn => projectDecisions.id),
    made_at: timestamp('made_at', { withTimezone: true }).notNull().defaultNow(),
    made_by: text('made_by').notNull(),
  },
  (t) => [
    index('project_decisions_project_time').on(t.project_id, t.made_at.desc()),
    index('project_decisions_current').on(t.project_id).where(sql`superseded_by IS NULL`),
  ],
);
```

- [ ] **Step 8: Write `packages/db/src/schema/todos.ts`**

```typescript
import { pgTable, uuid, text, pgEnum, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects.js';

export const todoStatusEnum = pgEnum('todo_status', ['open', 'in_progress', 'done', 'cancelled']);

export const projectTodos = pgTable(
  'project_todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    status: todoStatusEnum('status').notNull().default('open'),
    added_at: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    added_by: text('added_by').notNull(),
  },
  (t) => [
    index('project_todos_open')
      .on(t.project_id, t.added_at.desc())
      .where(sql`status IN ('open','in_progress')`),
  ],
);
```

- [ ] **Step 9: Write `packages/db/src/schema/notes.ts`**

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectNotes = pgTable(
  'project_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    author: text('author').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_notes_project_time').on(t.project_id, t.created_at.desc())],
);
```

- [ ] **Step 10: Write `packages/db/src/schema/index.ts`**

```typescript
export * from './projects.js';
export * from './events.js';
export * from './decisions.js';
export * from './todos.js';
export * from './notes.js';
```

- [ ] **Step 11: Write `packages/db/src/index.ts` (placeholder; client comes in Task 7)**

```typescript
export * as schema from './schema/index.js';
```

- [ ] **Step 12: Install workspace deps**

Run:
```bash
npm install
```
Expected: drizzle-orm, drizzle-kit, pg, tsx all installed at root; @foundry/db linked to @foundry/shared.

- [ ] **Step 13: Typecheck the schema files**

Run:
```bash
npm run typecheck --workspace @foundry/db
```
Expected: no type errors.

- [ ] **Step 14: Commit**

```bash
git add packages/db/
git commit -m "feat(db): drizzle schema declarations for projects + 4 history tables

Declares the typed schema for projects (with CHECK constraint, partial
indexes, vector(1536), gin_trgm for name fuzzy search) and the four append-
only/aspect tables: project_events, project_decisions (self-referencing
superseded_by), project_todos, project_notes. Hand-written SQL migrations
come in tasks 8 and 9."
```

---

## Task 7: packages/db client factory

**Files:**
- Create: `packages/db/src/client.ts`, `packages/db/tests/client.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write `packages/db/tests/client.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createDbClient } from '../src/client.js';

describe('createDbClient', () => {
  it('returns an object with db and pool when given a URL', () => {
    const client = createDbClient('postgres://x:y@localhost:5433/foundry');
    expect(client).toHaveProperty('db');
    expect(client).toHaveProperty('pool');
    expect(typeof client.close).toBe('function');
    // Don't actually connect — the URL is fake. Just verify shape.
  });
  it('throws when given an empty URL', () => {
    expect(() => createDbClient('')).toThrow();
  });
  it('reads from env when no URL passed and DB_URL_APP is set', () => {
    process.env.DB_URL_APP = 'postgres://x:y@localhost:5433/foundry';
    const client = createDbClient();
    expect(client).toHaveProperty('db');
    delete process.env.DB_URL_APP;
  });
  it('throws when no URL passed and no env var set', () => {
    delete process.env.DB_URL_APP;
    expect(() => createDbClient()).toThrow(/DB_URL_APP/);
  });
});
```

- [ ] **Step 2: Run the test (should fail because file doesn't exist)**

Run:
```bash
npm test --workspace @foundry/db
```
Expected: import resolution fails.

- [ ] **Step 3: Implement `packages/db/src/client.ts`**

```typescript
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export interface DbClient {
  db: NodePgDatabase<typeof schema>;
  pool: pg.Pool;
  close: () => Promise<void>;
}

export function createDbClient(url?: string): DbClient {
  const connectionString = url ?? process.env.DB_URL_APP;
  if (!connectionString) {
    throw new Error('DB_URL_APP env var must be set or url passed to createDbClient()');
  }
  const pool = new pg.Pool({
    connectionString,
    statement_timeout: 10_000, // 10s — catches runaway queries
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}
```

- [ ] **Step 4: Update `packages/db/src/index.ts`**

```typescript
export * as schema from './schema/index.js';
export * from './client.js';
```

- [ ] **Step 5: Run the test and verify it passes**

Run:
```bash
npm test --workspace @foundry/db
```
Expected: all client.test.ts cases pass.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/client.ts packages/db/src/index.ts packages/db/tests/client.test.ts
git commit -m "feat(db): createDbClient factory wrapping pg pool + Drizzle

Reads from DB_URL_APP env var by default (the restricted runtime role) and
sets a 10s statement_timeout to catch runaway queries. Returns the Drizzle
db handle, the underlying pool, and a close() helper for tests."
```

---

## Task 8: Migration 0001_init

**Files:**
- Create: `packages/db/migrations/0001_init.sql`, `packages/db/migrations/meta/_journal.json`, `packages/db/src/scripts/migrate.ts`

- [ ] **Step 1: Write `packages/db/migrations/0001_init.sql`**

```sql
-- Foundry migration 0001: initial schema
-- Creates the projects table with constraints, indexes, and the updated_at trigger.

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
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_touch_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

CREATE INDEX projects_dashboard
  ON projects (archived, pinned DESC, updated_at DESC);
CREATE INDEX projects_status
  ON projects (status)
  WHERE archived = false;
CREATE INDEX projects_name_trgm
  ON projects USING gin (name gin_trgm_ops);

-- foundry_app gets full DML on projects (mutable current state).
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO foundry_app;
GRANT USAGE ON TYPE project_status TO foundry_app;
```

- [ ] **Step 2: Write `packages/db/migrations/meta/_journal.json`**

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1747440000000,
      "tag": "0001_init",
      "breakpoints": false
    }
  ]
}
```

- [ ] **Step 3: Write `packages/db/src/scripts/migrate.ts`**

```typescript
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '..', '..', 'migrations');

async function main() {
  const url = process.env.DB_URL_MIGRATE;
  if (!url) {
    console.error('DB_URL_MIGRATE env var not set');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);
  console.log(`Running migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log('Migrations applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Add `dotenv` to packages/db dependencies**

Edit `packages/db/package.json` — add to `dependencies`:
```json
"dotenv": "^16.4.0"
```

Then run:
```bash
npm install
```

- [ ] **Step 5: Apply the migration**

Run from `/home/joeyang/dev-tools/foundry`:
```bash
export $(grep -v '^#' .env 2>/dev/null | xargs) 2>/dev/null
[ -z "$DB_URL_MIGRATE" ] && cp .env.example .env && export $(grep -v '^#' .env | xargs)
npm run migrate --workspace @foundry/db
```
Expected: `Running migrations from .../migrations...` then `Migrations applied.`.

- [ ] **Step 6: Verify the schema landed**

Run:
```bash
docker exec foundry-postgres psql -U foundry -d foundry -c "\d projects"
docker exec foundry-postgres psql -U foundry -d foundry -c "SELECT extname FROM pg_extension WHERE extname IN ('vector','pg_trgm');"
docker exec foundry-postgres psql -U foundry -d foundry -c "\di projects_*"
```
Expected: `\d projects` lists all 19 columns and the CHECK constraint; both extensions are present; three `projects_*` indexes shown.

- [ ] **Step 7: Commit**

```bash
git add packages/db/migrations/0001_init.sql packages/db/migrations/meta/_journal.json packages/db/src/scripts/migrate.ts packages/db/package.json package-lock.json
git commit -m "feat(db): migration 0001_init — projects table with extensions, indexes, trigger

Creates vector + pg_trgm extensions, the project_status enum, the projects
table with CHECK constraint on summary length, three indexes tuned for
dashboard queries, and the updated_at trigger. Grants full DML on projects
to foundry_app (mutable current state)."
```

---

## Task 9: Migration 0002_history with append-only role grants

**Files:**
- Create: `packages/db/migrations/0002_history.sql`
- Modify: `packages/db/migrations/meta/_journal.json`

- [ ] **Step 1: Write `packages/db/migrations/0002_history.sql`**

```sql
-- Foundry migration 0002: history tables (append-only) + first-class aspects
-- project_events, project_decisions, project_todos, project_notes.
-- Role grants enforce append-only at the DB layer: foundry_app may INSERT
-- and SELECT on history tables but has NO UPDATE/DELETE.

CREATE TYPE project_event_kind AS ENUM (
  'created',
  'status_changed',
  'next_step_changed',
  'summary_changed',
  'goal_changed',
  'links_changed',
  'tech_stack_changed',
  'human_flag_changed'
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

-- Role grants: enforce append-only at the DB layer.
-- foundry_app: INSERT + SELECT on history tables, NO UPDATE/DELETE.
GRANT INSERT, SELECT ON project_events TO foundry_app;
GRANT INSERT, SELECT ON project_decisions TO foundry_app;
GRANT INSERT, SELECT ON project_notes TO foundry_app;

-- project_todos has mutable status — full DML allowed.
GRANT SELECT, INSERT, UPDATE, DELETE ON project_todos TO foundry_app;

GRANT USAGE ON TYPE project_event_kind TO foundry_app;
GRANT USAGE ON TYPE todo_status TO foundry_app;
```

- [ ] **Step 2: Update `packages/db/migrations/meta/_journal.json`**

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1747440000000,
      "tag": "0001_init",
      "breakpoints": false
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1747526400000,
      "tag": "0002_history",
      "breakpoints": false
    }
  ]
}
```

- [ ] **Step 3: Apply the migration**

Run:
```bash
npm run migrate --workspace @foundry/db
```
Expected: `Migrations applied.`. Subsequent runs are no-ops.

- [ ] **Step 4: Verify the new tables and grants**

Run:
```bash
docker exec foundry-postgres psql -U foundry -d foundry -c "\dt project_*"
docker exec foundry-postgres psql -U foundry -d foundry -c "\dp project_events"
```
Expected: all five tables listed (projects, project_events, project_decisions, project_todos, project_notes); `\dp project_events` shows `foundry_app=ar/foundry` (INSERT + SELECT only, no UPDATE/DELETE letters).

- [ ] **Step 5: Sanity-check that the append-only role can't UPDATE**

Run:
```bash
docker exec foundry-postgres psql -U foundry_app -d foundry -c "UPDATE project_events SET actor='hacked' WHERE 1=0;"
```
Expected: `ERROR: permission denied for table project_events`. (The `WHERE 1=0` ensures even a successful update would do nothing — we just want the permission check to fire.)

- [ ] **Step 6: Commit**

```bash
git add packages/db/migrations/0002_history.sql packages/db/migrations/meta/_journal.json
git commit -m "feat(db): migration 0002_history — append-only events, decisions, notes + todos

Creates project_events (kind enum + jsonb payload), project_decisions (with
self-referencing superseded_by chain and decision jsonb escape hatch),
project_todos (mutable status), and project_notes. Role grants enforce the
append-only invariant at the DB layer: foundry_app has INSERT+SELECT only
on events/decisions/notes, full DML on todos."
```

---

## Task 10: Migration round-trip test

**Files:**
- Create: `packages/db/tests/helpers.ts`, `packages/db/tests/migrations.test.ts`

- [ ] **Step 1: Write `packages/db/tests/helpers.ts`**

```typescript
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '..', 'migrations');

const MIGRATE_URL =
  process.env.DB_URL_MIGRATE ?? 'postgres://foundry:foundry@localhost:5433/foundry';

/**
 * Create a fresh Postgres schema, run all migrations against it, and return
 * a pool whose search_path points at that schema. Caller must invoke
 * `close()` in afterAll to drop the schema and release the pool.
 */
export async function createTestSchema(): Promise<{
  schemaName: string;
  pool: pg.Pool;
  close: () => Promise<void>;
}> {
  const schemaName = `test_${randomBytes(6).toString('hex')}`;
  const adminPool = new pg.Pool({ connectionString: MIGRATE_URL });
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  await adminPool.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO foundry_app`);
  await adminPool.query(`GRANT CREATE ON SCHEMA "${schemaName}" TO foundry_app`);
  await adminPool.end();

  const pool = new pg.Pool({ connectionString: MIGRATE_URL });
  pool.on('connect', (c) => {
    c.query(`SET search_path TO "${schemaName}", public`);
  });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });

  return {
    schemaName,
    pool,
    close: async () => {
      await pool.end();
      const cleanup = new pg.Pool({ connectionString: MIGRATE_URL });
      await cleanup.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      await cleanup.end();
    },
  };
}
```

- [ ] **Step 2: Write `packages/db/tests/migrations.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createTestSchema } from './helpers.js';

describe('migrations', () => {
  let ctx: Awaited<ReturnType<typeof createTestSchema>>;

  beforeAll(async () => {
    ctx = await createTestSchema();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates all five tables', async () => {
    const { rows } = await ctx.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 ORDER BY table_name`,
      [ctx.schemaName],
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual([
      '__drizzle_migrations',
      'project_decisions',
      'project_events',
      'project_notes',
      'project_todos',
      'projects',
    ]);
  });

  it('projects has the CHECK constraint on summary length', async () => {
    await expect(
      ctx.pool.query(
        `INSERT INTO projects (path, slug, name, summary) VALUES ($1, $2, $3, $4)`,
        ['/x', 'x', 'x', 'a'.repeat(281)],
      ),
    ).rejects.toThrow(/summary_length/);
  });

  it('updated_at trigger fires on UPDATE', async () => {
    const insert = await ctx.pool.query<{ id: string; updated_at: Date }>(
      `INSERT INTO projects (path, slug, name, summary) VALUES ($1,$2,$3,$4) RETURNING id, updated_at`,
      ['/trig', 'trig', 'trig', 'short'],
    );
    const before = insert.rows[0]!.updated_at;
    await new Promise((r) => setTimeout(r, 20));
    const update = await ctx.pool.query<{ updated_at: Date }>(
      `UPDATE projects SET name = 'trig2' WHERE id = $1 RETURNING updated_at`,
      [insert.rows[0]!.id],
    );
    expect(update.rows[0]!.updated_at.getTime()).toBeGreaterThan(before.getTime());
  });

  it('cascade delete removes child rows', async () => {
    const p = await ctx.pool.query<{ id: string }>(
      `INSERT INTO projects (path, slug, name, summary) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['/cascade', 'cascade', 'cascade', 'cascade'],
    );
    const pid = p.rows[0]!.id;
    await ctx.pool.query(
      `INSERT INTO project_events (project_id, kind, payload, actor) VALUES ($1, 'created', '{}', 'agent:test')`,
      [pid],
    );
    await ctx.pool.query(
      `INSERT INTO project_todos (project_id, text, added_by) VALUES ($1, 't', 'agent:test')`,
      [pid],
    );
    await ctx.pool.query(`DELETE FROM projects WHERE id = $1`, [pid]);
    const ev = await ctx.pool.query(`SELECT count(*) FROM project_events WHERE project_id = $1`, [pid]);
    const td = await ctx.pool.query(`SELECT count(*) FROM project_todos WHERE project_id = $1`, [pid]);
    expect(ev.rows[0].count).toBe('0');
    expect(td.rows[0].count).toBe('0');
  });

  it('vector extension is loaded and accepts a 1536-dim vector', async () => {
    const v = `[${new Array(1536).fill(0.5).join(',')}]`;
    const p = await ctx.pool.query<{ id: string }>(
      `INSERT INTO projects (path, slug, name, summary, search_embedding) VALUES ($1,$2,$3,$4,$5::vector) RETURNING id`,
      ['/vec', 'vec', 'vec', 'vec', v],
    );
    expect(p.rows[0]!.id).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test**

Run:
```bash
export $(grep -v '^#' .env | xargs)
npm test --workspace @foundry/db
```
Expected: all five `migrations` cases pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/tests/helpers.ts packages/db/tests/migrations.test.ts
git commit -m "test(db): per-schema migration round-trip + invariants

Adds createTestSchema helper that creates a fresh Postgres schema, runs all
migrations into it, and returns a pool scoped to that schema. Tests assert
that all five tables exist, the summary CHECK fires, the updated_at trigger
bumps on UPDATE, cascade delete clears child rows, and the vector(1536)
column accepts an embedding."
```

---

## Task 11: Append-only DB role enforcement test

**Files:**
- Create: `packages/db/tests/append-only.test.ts`

- [ ] **Step 1: Write `packages/db/tests/append-only.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createTestSchema } from './helpers.js';

const APP_URL =
  process.env.DB_URL_APP ?? 'postgres://foundry_app:foundry_app@localhost:5433/foundry';

describe('append-only role enforcement', () => {
  let ctx: Awaited<ReturnType<typeof createTestSchema>>;
  let appPool: pg.Pool;
  let projectId: string;

  beforeAll(async () => {
    ctx = await createTestSchema();
    appPool = new pg.Pool({ connectionString: APP_URL });
    appPool.on('connect', (c) => {
      c.query(`SET search_path TO "${ctx.schemaName}", public`);
    });

    // Seed one project so we have child rows to attempt to mutate.
    const p = await ctx.pool.query<{ id: string }>(
      `INSERT INTO projects (path, slug, name, summary) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['/seed', 'seed', 'seed', 'seed'],
    );
    projectId = p.rows[0]!.id;
    await ctx.pool.query(
      `INSERT INTO project_events (project_id, kind, payload, actor) VALUES ($1,'created','{}','agent:test')`,
      [projectId],
    );
    await ctx.pool.query(
      `INSERT INTO project_decisions (project_id, title, rationale, made_by) VALUES ($1,'t','r','agent:test')`,
      [projectId],
    );
    await ctx.pool.query(
      `INSERT INTO project_notes (project_id, body, author) VALUES ($1,'note','agent:test')`,
      [projectId],
    );
    await ctx.pool.query(
      `INSERT INTO project_todos (project_id, text, added_by) VALUES ($1,'todo','agent:test')`,
      [projectId],
    );
  });

  afterAll(async () => {
    await appPool.end();
    await ctx.close();
  });

  it('foundry_app can SELECT project_events', async () => {
    const { rows } = await appPool.query(`SELECT count(*) FROM project_events`);
    expect(rows[0].count).toBe('1');
  });

  it('foundry_app can INSERT into project_events', async () => {
    await expect(
      appPool.query(
        `INSERT INTO project_events (project_id, kind, payload, actor) VALUES ($1,'status_changed','{}','agent:test')`,
        [projectId],
      ),
    ).resolves.toBeDefined();
  });

  it('foundry_app CANNOT UPDATE project_events', async () => {
    await expect(
      appPool.query(`UPDATE project_events SET actor='hacker' WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT DELETE from project_events', async () => {
    await expect(
      appPool.query(`DELETE FROM project_events WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT UPDATE project_decisions', async () => {
    await expect(
      appPool.query(`UPDATE project_decisions SET title='x' WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT DELETE project_decisions', async () => {
    await expect(
      appPool.query(`DELETE FROM project_decisions WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT UPDATE project_notes', async () => {
    await expect(
      appPool.query(`UPDATE project_notes SET body='x' WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CANNOT DELETE project_notes', async () => {
    await expect(
      appPool.query(`DELETE FROM project_notes WHERE project_id = $1`, [projectId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('foundry_app CAN UPDATE project_todos (mutable status)', async () => {
    await expect(
      appPool.query(`UPDATE project_todos SET status='done', completed_at=now() WHERE project_id = $1`, [projectId]),
    ).resolves.toBeDefined();
  });

  it('foundry_app CAN UPDATE projects (mutable current state)', async () => {
    await expect(
      appPool.query(`UPDATE projects SET name='renamed' WHERE id = $1`, [projectId]),
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test**

Run:
```bash
npm test --workspace @foundry/db
```
Expected: all 10 append-only enforcement cases pass alongside the existing migration tests.

- [ ] **Step 3: Commit**

```bash
git add packages/db/tests/append-only.test.ts
git commit -m "test(db): assert DB-level append-only enforcement on history tables

Seeds one project plus a row in each child table, then attempts UPDATE and
DELETE as the foundry_app role. Asserts permission-denied for events,
decisions, notes; allows UPDATE on the mutable tables (todos current state,
projects current state). Codifies the spec's append-only invariant."
```

---

## Task 12: apps/api scaffold and LiveTracker (TDD)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/services/live-tracker.ts`, `apps/api/tests/live-tracker.test.ts`

- [ ] **Step 1: Write `apps/api/package.json`**

```json
{
  "name": "@foundry/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@foundry/shared": "*",
    "@foundry/db": "*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `apps/api/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Install workspace deps**

Run:
```bash
npm install
```

- [ ] **Step 5: Write the failing LiveTracker test**

Create `apps/api/tests/live-tracker.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveTracker } from '../src/services/live-tracker.js';

describe('LiveTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for unknown ids', () => {
    const t = new LiveTracker();
    expect(t.isLive('00000000-0000-0000-0000-000000000001')).toBe(false);
  });

  it('returns true after beat() within TTL', () => {
    const t = new LiveTracker(60_000); // 60s
    t.beat('abc');
    expect(t.isLive('abc')).toBe(true);
  });

  it('returns true just before the TTL boundary', () => {
    const t = new LiveTracker(60_000);
    t.beat('abc');
    vi.advanceTimersByTime(59_999);
    expect(t.isLive('abc')).toBe(true);
  });

  it('returns false just after the TTL boundary', () => {
    const t = new LiveTracker(60_000);
    t.beat('abc');
    vi.advanceTimersByTime(60_000);
    expect(t.isLive('abc')).toBe(false);
  });

  it('defaults to 30-minute TTL', () => {
    const t = new LiveTracker();
    t.beat('abc');
    vi.advanceTimersByTime(30 * 60 * 1000 - 1);
    expect(t.isLive('abc')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(t.isLive('abc')).toBe(false);
  });

  it('beat() refreshes the timestamp', () => {
    const t = new LiveTracker(60_000);
    t.beat('abc');
    vi.advanceTimersByTime(50_000);
    t.beat('abc');
    vi.advanceTimersByTime(50_000);
    expect(t.isLive('abc')).toBe(true); // 50s since last beat, still within TTL
  });

  it('evictExpired() removes entries older than 2*TTL', () => {
    const t = new LiveTracker(60_000);
    t.beat('old');
    vi.advanceTimersByTime(121_000); // > 2 * 60s
    t.beat('fresh');
    t.evictExpired();
    expect(t.size).toBe(1);
    expect(t.isLive('old')).toBe(false);
    expect(t.isLive('fresh')).toBe(true);
  });

  it('evictExpired() keeps entries within 2*TTL even if not live', () => {
    const t = new LiveTracker(60_000);
    t.beat('borderline');
    vi.advanceTimersByTime(90_000); // past TTL but within 2*TTL
    t.evictExpired();
    expect(t.size).toBe(1);
    expect(t.isLive('borderline')).toBe(false);
  });

  it('size reflects the number of tracked ids', () => {
    const t = new LiveTracker();
    expect(t.size).toBe(0);
    t.beat('a');
    t.beat('b');
    expect(t.size).toBe(2);
    t.beat('a'); // overwrite, no growth
    expect(t.size).toBe(2);
  });
});
```

- [ ] **Step 6: Run the test (should fail — file doesn't exist)**

Run:
```bash
npm test --workspace @foundry/api
```
Expected: import resolution failure.

- [ ] **Step 7: Implement `apps/api/src/services/live-tracker.ts`**

```typescript
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export class LiveTracker {
  private heartbeats = new Map<string, number>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  beat(projectId: string): void {
    this.heartbeats.set(projectId, Date.now());
  }

  isLive(projectId: string): boolean {
    const last = this.heartbeats.get(projectId);
    if (last === undefined) return false;
    return Date.now() - last < this.ttlMs;
  }

  evictExpired(): void {
    const cutoff = Date.now() - this.ttlMs * 2;
    for (const [id, ts] of this.heartbeats) {
      if (ts < cutoff) this.heartbeats.delete(id);
    }
  }

  get size(): number {
    return this.heartbeats.size;
  }
}
```

- [ ] **Step 8: Run the test and verify it passes**

Run:
```bash
npm test --workspace @foundry/api
```
Expected: all 9 LiveTracker cases pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/
git commit -m "feat(api): LiveTracker — in-memory liveness tracking, 30-min TTL default

Pure service with beat(id), isLive(id), evictExpired(), and a size accessor.
TTL defaults to 30 min (FOUNDRY_HEARTBEAT_TTL_SEC env-var integration comes
in Plan 2 when the server wires it up). Eviction cutoff is 2*TTL so a stale
but recently-expired entry stays around briefly for any reads-still-in-flight.
Tests use vi.useFakeTimers() for deterministic TTL boundaries."
```

---

## Verification — Plan 1 complete

After Task 12 commits, the repo should pass a full test sweep:

- [ ] **Step 1: Run the entire test suite**

Run:
```bash
docker compose -f docker/docker-compose.yml ps                      # postgres must be running
export $(grep -v '^#' .env | xargs)
npm test
```

Expected: all suites green —
- `@foundry/shared` — enum, project, decision, todo, note, event schemas
- `@foundry/db` — migrations round-trip, append-only enforcement (10 cases), client factory
- `@foundry/api` — LiveTracker (9 cases)

- [ ] **Step 2: Sanity-check the repo state**

Run:
```bash
git log --oneline
ls packages/shared/src packages/db/src apps/api/src
docker exec foundry-postgres psql -U foundry -d foundry -c "\dt"
```

Expected: 12 commits since the initial empty state; all source files present; all 5 application tables in the docker DB.

---

## What's NOT in Plan 1 (carried forward to later plans)

- No Fastify server, no route handlers — Plan 2.
- No MCP plugin — Plan 2.
- No frontend code — Plan 3.
- No Playwright e2e tests — Plan 3.
- No CI configuration — out of scope for v1; can be added later.
- No production secrets handling — `.env` with hardcoded local creds is fine for the personal local app.

---

## Reference

- Spec: `docs/superpowers/specs/2026-05-16-foundry-design.md`
- Plan 2 (Backend): to be written after Plan 1 lands
- Plan 3 (Frontend): to be written after Plan 2 lands
