# Foundry Plan 2: Backend (API + MCP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the Fastify daemon that hosts both the REST API (`/v1/*`) and the MCP server (`/mcp`). All agent-facing handlers (with implicit liveness beat + event emission on tracked field changes), all human/dashboard read handlers, and a thin MCP plugin that wraps the agent handlers as tools.

**Architecture:** Single Fastify process. `apps/api` owns the server, route registration, DI wiring, and bootstrap. `apps/mcp` is a Fastify plugin library exposing MCP tools that call the same in-process handler functions used by the REST routes. Services contain business logic; routes are thin adapters. Database access goes through `@foundry/db`. Liveness tracked in-memory via `LiveTracker` (from Plan 1, Task 12).

**Tech Stack:** TypeScript · Node 22 · Fastify 5 · zod (via `@foundry/shared`) · Drizzle ORM (via `@foundry/db`) · pg · `@modelcontextprotocol/sdk` for the MCP plugin · vitest with real Postgres for integration tests.

**Reference spec:** `docs/superpowers/specs/2026-05-16-foundry-design.md` (Section 3 — API + MCP surface)
**Prior plan:** `docs/superpowers/plans/2026-05-17-foundry-plan-1-foundation.md`

---

## File map (additions to what Plan 1 produced)

```
foundry/
├── apps/
│   ├── api/
│   │   ├── package.json                       (modify: add fastify, fastify-type-provider-zod, pino-pretty)
│   │   ├── src/
│   │   │   ├── index.ts                       (modify: export server factory)
│   │   │   ├── server.ts                      (NEW: buildServer factory)
│   │   │   ├── boot.ts                        (NEW: process entry, calls listen())
│   │   │   ├── config.ts                      (NEW: env var parsing via zod)
│   │   │   ├── errors.ts                      (NEW: AppError + error mapper)
│   │   │   ├── middleware/
│   │   │   │   ├── request-id.ts              (NEW)
│   │   │   │   └── error-handler.ts           (NEW)
│   │   │   ├── services/
│   │   │   │   ├── live-tracker.ts            (exists from Plan 1)
│   │   │   │   ├── slug.ts                    (NEW: slug derivation + uniqueness)
│   │   │   │   ├── decay.ts                   (NEW: stale/fossil derivation)
│   │   │   │   ├── agent-projects.ts          (NEW: upsert, status, next-step, get)
│   │   │   │   ├── agent-decisions.ts         (NEW: add, supersede)
│   │   │   │   ├── agent-todos.ts             (NEW: add, update)
│   │   │   │   ├── agent-notes.ts             (NEW: add)
│   │   │   │   ├── dashboard.ts               (NEW: list, detail, timeline, aspect queries)
│   │   │   │   └── flags.ts                   (NEW: human flag PATCH + delete)
│   │   │   └── routes/
│   │   │       ├── agent/
│   │   │       │   ├── index.ts               (NEW: route group registration)
│   │   │       │   ├── upsert.ts
│   │   │       │   ├── heartbeat.ts
│   │   │       │   ├── status.ts
│   │   │       │   ├── next-step.ts
│   │   │       │   ├── decisions.ts
│   │   │       │   ├── todos.ts
│   │   │       │   ├── notes.ts
│   │   │       │   └── get.ts
│   │   │       ├── dashboard/
│   │   │       │   ├── index.ts               (NEW)
│   │   │       │   ├── list.ts
│   │   │       │   ├── detail.ts
│   │   │       │   ├── timeline.ts
│   │   │       │   ├── aspects.ts             (decisions/todos/notes endpoints)
│   │   │       │   ├── flags.ts
│   │   │       │   └── delete.ts
│   │   │       └── health.ts                  (NEW: /v1/healthz, /v1/livez)
│   │   └── tests/
│   │       ├── helpers/
│   │       │   ├── test-server.ts             (spin up Fastify against test schema)
│   │       │   └── seed.ts                    (helpers to insert test projects)
│   │       ├── services/
│   │       │   ├── slug.test.ts
│   │       │   ├── decay.test.ts
│   │       │   ├── agent-projects.test.ts
│   │       │   ├── agent-decisions.test.ts
│   │       │   ├── agent-todos.test.ts
│   │       │   └── agent-notes.test.ts
│   │       └── routes/
│   │           ├── agent-upsert.test.ts
│   │           ├── agent-heartbeat.test.ts
│   │           ├── agent-flow.test.ts         (multi-call integration)
│   │           ├── dashboard-list.test.ts
│   │           ├── dashboard-detail.test.ts
│   │           ├── dashboard-flags.test.ts
│   │           └── health.test.ts
│   └── mcp/
│       ├── package.json                       (NEW workspace)
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── index.ts                       (NEW: plugin export)
│       │   ├── plugin.ts                      (Fastify plugin registration)
│       │   └── tools.ts                       (tool list mapped 1:1 to agent handlers)
│       └── tests/
│           └── plugin.test.ts
└── packages/
    └── db/
        └── src/
            └── queries/                       (NEW: query helpers used by services)
                ├── projects.ts
                ├── events.ts
                ├── decisions.ts
                ├── todos.ts
                ├── notes.ts
                └── timeline.ts
```

---

## Task 1: apps/api Fastify scaffold + health endpoints + boot script

**Files:**
- Modify: `apps/api/package.json` (add `fastify`, `fastify-type-provider-zod`, `pino-pretty`)
- Create: `apps/api/src/config.ts`, `apps/api/src/server.ts`, `apps/api/src/boot.ts`, `apps/api/src/routes/health.ts`
- Modify: `apps/api/src/index.ts` (export `buildServer`)
- Create: `apps/api/tests/routes/health.test.ts`, `apps/api/tests/helpers/test-server.ts`

- [ ] **Step 1: Update `apps/api/package.json`**

Add to dependencies:
```json
"fastify": "^5.0.0",
"fastify-type-provider-zod": "^4.0.0",
"@foundry/shared": "*",
"@foundry/db": "*",
"zod": "^3.23.0",
"pg": "^8.13.0"
```

Add to devDependencies:
```json
"pino-pretty": "^11.0.0",
"@types/pg": "^8.11.0"
```

Add to scripts:
```json
"dev": "tsx watch src/boot.ts",
"start": "node --import tsx src/boot.ts"
```

Then run from repo root: `npm install`.

- [ ] **Step 2: Write `apps/api/src/config.ts`**

```typescript
import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(5380),
  host: z.string().default('127.0.0.1'),
  dbUrlApp: z.string().min(1),
  heartbeatTtlSec: z.coerce.number().int().positive().default(1800),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse({
    port: env.PORT,
    host: env.HOST,
    dbUrlApp: env.DB_URL_APP,
    heartbeatTtlSec: env.FOUNDRY_HEARTBEAT_TTL_SEC,
    logLevel: env.LOG_LEVEL,
  });
}
```

- [ ] **Step 3: Write `apps/api/src/server.ts`**

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createDbClient, type DbClient } from '@foundry/db';
import { LiveTracker } from './services/live-tracker.js';
import { type Config } from './config.js';
import { healthRoutes } from './routes/health.js';

export interface ServerDeps {
  config: Config;
  db: DbClient;
  liveTracker: LiveTracker;
}

export async function buildServer(config: Config, dbOverride?: DbClient): Promise<FastifyInstance> {
  const db = dbOverride ?? createDbClient(config.dbUrlApp);
  const liveTracker = new LiveTracker(config.heartbeatTtlSec * 1000);

  const app = Fastify({
    logger: { level: config.logLevel },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Make deps available to route handlers via app.deps
  app.decorate('deps', { config, db, liveTracker } as ServerDeps);

  app.register(healthRoutes, { prefix: '/v1' });

  app.addHook('onClose', async () => {
    await db.close();
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: ServerDeps;
  }
}
```

- [ ] **Step 4: Write `apps/api/src/boot.ts`**

```typescript
import 'dotenv/config';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';

async function main() {
  const config = loadConfig();
  const app = await buildServer(config);
  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error('Failed to start foundry server:', err);
  process.exit(1);
});
```

Add `dotenv` to apps/api dependencies (`npm install dotenv -w @foundry/api`).

- [ ] **Step 5: Write `apps/api/src/routes/health.ts`**

```typescript
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/livez', async () => {
    try {
      await app.deps.db.pool.query('SELECT 1');
      return { status: 'ok' };
    } catch (err) {
      app.log.error({ err }, 'livez failed');
      return { status: 'degraded', reason: 'db unreachable' };
    }
  });
}
```

- [ ] **Step 6: Update `apps/api/src/index.ts`**

```typescript
export { buildServer } from './server.js';
export { loadConfig, type Config } from './config.js';
```

- [ ] **Step 7: Write `apps/api/tests/helpers/test-server.ts`**

```typescript
import { buildServer } from '../../src/server.js';
import type { Config } from '../../src/config.js';
import { createDbClient } from '@foundry/db';
import type { FastifyInstance } from 'fastify';
import { createTestSchema } from '../../../../packages/db/tests/helpers.js';
import pg from 'pg';

export interface TestStack {
  app: FastifyInstance;
  schemaName: string;
  cleanup: () => Promise<void>;
}

const APP_URL =
  process.env.DB_URL_APP ?? 'postgres://foundry_app:foundry_app@localhost:5433/foundry';

export async function startTestServer(overrides: Partial<Config> = {}): Promise<TestStack> {
  const ctx = await createTestSchema();

  // App-role pool scoped to the test schema
  const appPool = new pg.Pool({ connectionString: APP_URL });
  appPool.on('connect', (c) => {
    c.query(`SET search_path TO "${ctx.schemaName}", public`);
  });
  const db = {
    db: createDbClient(APP_URL).db, // schema-bound via search_path on appPool
    pool: appPool,
    close: async () => {
      await appPool.end();
    },
  };
  // Replace the db.db with one bound to appPool
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const schema = await import('@foundry/db');
  db.db = drizzle(appPool, { schema: schema.schema });

  const config: Config = {
    port: 0,
    host: '127.0.0.1',
    dbUrlApp: APP_URL,
    heartbeatTtlSec: 1800,
    logLevel: 'fatal',
    ...overrides,
  };

  const app = await buildServer(config, db as unknown as ReturnType<typeof createDbClient>);

  return {
    app,
    schemaName: ctx.schemaName,
    cleanup: async () => {
      await app.close();
      await ctx.close();
    },
  };
}
```

- [ ] **Step 8: Write `apps/api/tests/routes/health.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';

describe('GET /v1/healthz', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  it('returns ok', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /v1/livez', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  it('returns ok when db reachable', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/livez' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 9: Run + commit**

```bash
export $(grep -v '^#' .env | xargs)
npm test --workspace @foundry/api
git add apps/api/ package.json package-lock.json
git commit -m "feat(api): Fastify scaffold + health endpoints + test server helper

buildServer factory wires DI (config, db, liveTracker) and registers /v1
routes via fastify-type-provider-zod. boot.ts is the process entry. health
routes (/v1/healthz returns ok; /v1/livez probes the db). test-server helper
boots Fastify against a per-test Postgres schema so route tests can use
app.inject() without polluting other tests' data."
```

---

## Task 2: Error model + request_id middleware + zod validation plugin

**Files:**
- Create: `apps/api/src/errors.ts`, `apps/api/src/middleware/request-id.ts`, `apps/api/src/middleware/error-handler.ts`
- Modify: `apps/api/src/server.ts` (register middleware)
- Create: `apps/api/tests/middleware/error-handler.test.ts`

- [ ] **Step 1: Write `apps/api/src/errors.ts`**

```typescript
export type ErrorCode = 'VALIDATION_FAILED' | 'NOT_FOUND' | 'CONFLICT' | 'CAPACITY' | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (msg: string) => new AppError('NOT_FOUND', 404, msg);
export const conflict = (msg: string) => new AppError('CONFLICT', 409, msg);
export const validation = (msg: string) => new AppError('VALIDATION_FAILED', 400, msg);
export const capacity = (msg: string) => new AppError('CAPACITY', 503, msg);
```

- [ ] **Step 2: Write `apps/api/src/middleware/request-id.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

export async function requestIdPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    (req as { requestId?: string }).requestId = requestId;
    reply.header('x-request-id', requestId);
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}
```

- [ ] **Step 3: Write `apps/api/src/middleware/error-handler.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

export async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    const requestId = req.requestId;

    if (err instanceof ZodError) {
      const message = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message,
        request_id: requestId,
      });
    }

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: err.code,
        message: err.message,
        request_id: requestId,
      });
    }

    // pg error class numbers
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: 'duplicate key',
        request_id: requestId,
      });
    }
    if (pgErr.code === '23514') {
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message: `check constraint failed: ${pgErr.constraint ?? 'unknown'}`,
        request_id: requestId,
      });
    }

    req.log.error({ err, requestId }, 'unhandled error');
    return reply.status(500).send({
      error: 'INTERNAL',
      message: 'internal server error',
      request_id: requestId,
    });
  });
}
```

- [ ] **Step 4: Register both plugins in `apps/api/src/server.ts`**

After `app.setSerializerCompiler(serializerCompiler);` and before `app.decorate(...)`, add:

```typescript
  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);
```

And import them at the top:
```typescript
import { requestIdPlugin } from './middleware/request-id.js';
import { errorHandlerPlugin } from './middleware/error-handler.js';
```

- [ ] **Step 5: Write `apps/api/tests/middleware/error-handler.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { AppError } from '../../src/errors.js';

describe('error handler', () => {
  let stack: TestStack;
  beforeAll(async () => {
    stack = await startTestServer();
    // Register an ad-hoc route that throws each kind of error.
    stack.app.get('/test/app-err', async () => {
      throw new AppError('NOT_FOUND', 404, 'thing not found');
    });
    stack.app.get('/test/unknown', async () => {
      throw new Error('something else');
    });
    await stack.app.ready();
  });
  afterAll(async () => { await stack.cleanup(); });

  it('echoes incoming X-Request-ID', async () => {
    const res = await stack.app.inject({
      method: 'GET',
      url: '/v1/healthz',
      headers: { 'x-request-id': 'req-abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('req-abc-123');
  });

  it('generates X-Request-ID when missing', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/v1/healthz' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('formats AppError correctly', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/test/app-err' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('thing not found');
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps unknown errors to 500 INTERNAL without leaking details', async () => {
    const res = await stack.app.inject({ method: 'GET', url: '/test/unknown' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error).toBe('INTERNAL');
    expect(body.message).toBe('internal server error');
    expect(body.message).not.toContain('something else');
  });
});
```

- [ ] **Step 6: Run + commit**

```bash
npm test --workspace @foundry/api
git add apps/api/src/errors.ts apps/api/src/middleware apps/api/src/server.ts apps/api/tests/middleware
git commit -m "feat(api): error model + request_id middleware + error handler

AppError class with typed code (NOT_FOUND/CONFLICT/VALIDATION_FAILED/CAPACITY/INTERNAL).
Error handler maps Zod, AppError, pg 23505 (unique), pg 23514 (check) to
spec-shaped error responses; unknown errors collapse to 500 INTERNAL without
leaking stack traces. request_id middleware echoes incoming X-Request-ID
or mints a UUID; surfaces on every response (including errors)."
```

---

## Task 3: Slug derivation + decay services (pure, unit tests)

**Files:**
- Create: `apps/api/src/services/slug.ts`, `apps/api/src/services/decay.ts`
- Create: `apps/api/tests/services/slug.test.ts`, `apps/api/tests/services/decay.test.ts`

- [ ] **Step 1: Write `apps/api/tests/services/slug.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { toSlug, ensureUniqueSlug } from '../../src/services/slug.js';

describe('toSlug', () => {
  it.each([
    ['foundry', 'foundry'],
    ['Foundry App', 'foundry-app'],
    ['My Project!', 'my-project'],
    ['   spaces   ', 'spaces'],
    ['under_scores', 'under-scores'],
    ['café', 'cafe'],
    ['', 'project'], // fallback
  ])('toSlug(%s) -> %s', (input, expected) => {
    expect(toSlug(input)).toBe(expected);
  });
});

describe('ensureUniqueSlug', () => {
  it('returns input if not taken', async () => {
    const out = await ensureUniqueSlug('foundry', async () => false);
    expect(out).toBe('foundry');
  });
  it('appends -2, -3, etc. on collisions', async () => {
    let calls = 0;
    const out = await ensureUniqueSlug('foundry', async (s) => {
      calls++;
      return s === 'foundry' || s === 'foundry-2';
    });
    expect(out).toBe('foundry-3');
    expect(calls).toBe(3);
  });
});
```

- [ ] **Step 2: Write `apps/api/src/services/slug.ts`**

```typescript
export function toSlug(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'project';
}

export async function ensureUniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  let i = 2;
  while (await isTaken(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
```

- [ ] **Step 3: Write `apps/api/tests/services/decay.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeDecay } from '../../src/services/decay.js';

describe('computeDecay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const now = new Date('2026-05-17T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  it.each([
    ['done',     daysAgo(89), 'fresh'],
    ['done',     daysAgo(91), 'stale'],
    ['done',     daysAgo(180), 'stale'],
    ['active',   daysAgo(91), 'fresh'],   // not stale unless done
    ['active',   daysAgo(366), 'fossil'],
    ['done',     daysAgo(366), 'fossil'], // fossil beats stale
    ['paused',   daysAgo(366), 'fossil'],
    ['blocked',  daysAgo(10), 'fresh'],
  ] as const)('status=%s updated=%s decay=%s', (status, updated, expected) => {
    expect(computeDecay(status, updated)).toBe(expected);
  });
});
```

- [ ] **Step 4: Write `apps/api/src/services/decay.ts`**

```typescript
import type { ProjectStatus, Decay } from '@foundry/shared';

const DAY_MS = 86_400_000;
const STALE_DAYS = 90;
const FOSSIL_DAYS = 365;

export function computeDecay(status: ProjectStatus, updatedAt: Date): Decay {
  const ageMs = Date.now() - updatedAt.getTime();
  const ageDays = ageMs / DAY_MS;
  if (ageDays >= FOSSIL_DAYS) return 'fossil';
  if (status === 'done' && ageDays >= STALE_DAYS) return 'stale';
  return 'fresh';
}
```

- [ ] **Step 5: Run + commit**

```bash
npm test --workspace @foundry/api
git add apps/api/src/services/slug.ts apps/api/src/services/decay.ts apps/api/tests/services/slug.test.ts apps/api/tests/services/decay.test.ts
git commit -m "feat(api): pure slug + decay services with full test coverage

toSlug normalizes Unicode, lowercases, hyphenates non-alphanumerics, trims
edges; falls back to 'project' for empty input. ensureUniqueSlug walks -2,
-3, ... via an isTaken predicate. computeDecay returns fresh/stale/fossil
based on status and updated_at age, with fossil (1yr) trumping stale (90d-done)."
```

---

## Task 4: agent-projects service — upsert, get, status, next-step (TDD)

**Files:**
- Create: `packages/db/src/queries/projects.ts`, `packages/db/src/queries/events.ts`
- Modify: `packages/db/src/index.ts` (re-export queries)
- Create: `apps/api/src/services/agent-projects.ts`
- Create: `apps/api/tests/services/agent-projects.test.ts`

- [ ] **Step 1: Write `packages/db/src/queries/events.ts`**

```typescript
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';
import type { ProjectEventKind } from '@foundry/shared';

export async function insertEvent(
  tx: NodePgDatabase<typeof schema>,
  projectId: string,
  kind: ProjectEventKind,
  payload: Record<string, unknown>,
  actor: string,
): Promise<void> {
  await tx.insert(schema.projectEvents).values({
    project_id: projectId,
    kind,
    payload,
    actor,
  });
}
```

- [ ] **Step 2: Write `packages/db/src/queries/projects.ts`**

```typescript
import { eq, sql, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';

export type ProjectRow = typeof schema.projects.$inferSelect;
export type ProjectInsert = typeof schema.projects.$inferInsert;

export async function findProjectByPath(
  db: NodePgDatabase<typeof schema>,
  path: string,
): Promise<ProjectRow | undefined> {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.path, path))
    .limit(1);
  return rows[0];
}

export async function findProjectBySlug(
  db: NodePgDatabase<typeof schema>,
  slug: string,
): Promise<ProjectRow | undefined> {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return rows[0];
}

export async function slugExists(
  db: NodePgDatabase<typeof schema>,
  slug: string,
): Promise<boolean> {
  const r = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return r.length > 0;
}

export async function insertProject(
  db: NodePgDatabase<typeof schema>,
  values: ProjectInsert,
): Promise<ProjectRow> {
  const rows = await db.insert(schema.projects).values(values).returning();
  return rows[0]!;
}

export async function updateProjectById(
  db: NodePgDatabase<typeof schema>,
  id: string,
  patch: Partial<ProjectInsert>,
): Promise<ProjectRow> {
  const rows = await db
    .update(schema.projects)
    .set(patch)
    .where(eq(schema.projects.id, id))
    .returning();
  return rows[0]!;
}

export async function deleteProjectBySlug(
  db: NodePgDatabase<typeof schema>,
  slug: string,
): Promise<number> {
  const rows = await db
    .delete(schema.projects)
    .where(eq(schema.projects.slug, slug))
    .returning({ id: schema.projects.id });
  return rows.length;
}
```

- [ ] **Step 3: Update `packages/db/src/index.ts`**

Add:
```typescript
export * from './queries/projects.js';
export * from './queries/events.js';
```

- [ ] **Step 4: Write `apps/api/src/services/agent-projects.ts`**

```typescript
import type { DbClient } from '@foundry/db';
import {
  findProjectByPath,
  insertProject,
  updateProjectById,
  slugExists,
  insertEvent,
  type ProjectRow,
} from '@foundry/db';
import type {
  UpsertProjectInput,
  SetStatusInput,
  SetNextStepInput,
} from '@foundry/shared';
import { toSlug, ensureUniqueSlug } from './slug.js';
import type { LiveTracker } from './live-tracker.js';
import { notFound } from '../errors.js';

export interface AgentProjectsDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

const TRACKED_FIELDS = [
  'status',
  'next_step',
  'summary',
  'goal',
  'links',
  'tech_stack',
] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

const EVENT_KIND_BY_FIELD: Record<TrackedField, string> = {
  status: 'status_changed',
  next_step: 'next_step_changed',
  summary: 'summary_changed',
  goal: 'goal_changed',
  links: 'links_changed',
  tech_stack: 'tech_stack_changed',
};

export function makeAgentProjects(deps: AgentProjectsDeps) {
  const { db, liveTracker } = deps;

  return {
    async upsert(input: UpsertProjectInput): Promise<ProjectRow> {
      return db.db.transaction(async (tx) => {
        const existing = await findProjectByPath(tx, input.path);

        if (!existing) {
          const baseSlug = toSlug(input.name);
          const slug = await ensureUniqueSlug(baseSlug, (s) => slugExists(tx, s));
          const project = await insertProject(tx, {
            path: input.path,
            slug,
            name: input.name,
            summary: input.summary,
            goal: input.goal ?? '',
            status: input.status ?? 'active',
            status_note: input.status_note ?? null,
            next_step: input.next_step ?? null,
            tech_stack: input.tech_stack ?? [],
            links: input.links ?? {},
            metadata: input.metadata ?? {},
          });
          await insertEvent(tx, project.id, 'created', {}, input.actor);
          liveTracker.beat(project.id);
          return project;
        }

        // Build patch + emit events per changed tracked field
        const patch: Partial<typeof existing> = {};
        const events: Array<{ kind: string; payload: Record<string, unknown> }> = [];

        for (const field of TRACKED_FIELDS) {
          const incoming = input[field as keyof UpsertProjectInput];
          if (incoming === undefined) continue;
          const current = existing[field as keyof ProjectRow];
          if (JSON.stringify(current) !== JSON.stringify(incoming)) {
            (patch as Record<string, unknown>)[field] = incoming;
            events.push({
              kind: EVENT_KIND_BY_FIELD[field],
              payload: { from: current, to: incoming },
            });
          }
        }

        // Non-tracked but still updatable: name, status_note, metadata
        if (input.name !== existing.name) patch.name = input.name;
        if (input.status_note !== undefined && input.status_note !== existing.status_note) {
          patch.status_note = input.status_note;
        }
        if (input.metadata !== undefined) {
          patch.metadata = { ...existing.metadata, ...input.metadata };
        }

        let updated = existing;
        if (Object.keys(patch).length > 0) {
          updated = await updateProjectById(tx, existing.id, patch);
        }
        for (const ev of events) {
          await insertEvent(tx, existing.id, ev.kind as any, ev.payload, input.actor);
        }
        liveTracker.beat(existing.id);
        return updated;
      });
    },

    async heartbeat(path: string): Promise<{ project_id: string }> {
      const existing = await findProjectByPath(db.db, path);
      if (!existing) throw notFound(`no project at path ${path}`);
      liveTracker.beat(existing.id);
      return { project_id: existing.id };
    },

    async setStatus(input: SetStatusInput): Promise<ProjectRow> {
      return db.db.transaction(async (tx) => {
        const existing = await findProjectByPath(tx, input.path);
        if (!existing) throw notFound(`no project at path ${input.path}`);
        if (existing.status === input.status && existing.status_note === (input.note ?? null)) {
          liveTracker.beat(existing.id);
          return existing; // no-op
        }
        const updated = await updateProjectById(tx, existing.id, {
          status: input.status,
          status_note: input.note ?? null,
        });
        await insertEvent(
          tx,
          existing.id,
          'status_changed',
          { from: existing.status, to: input.status, note: input.note ?? null },
          input.actor,
        );
        liveTracker.beat(existing.id);
        return updated;
      });
    },

    async setNextStep(input: SetNextStepInput): Promise<ProjectRow> {
      return db.db.transaction(async (tx) => {
        const existing = await findProjectByPath(tx, input.path);
        if (!existing) throw notFound(`no project at path ${input.path}`);
        if (existing.next_step === input.next_step) {
          liveTracker.beat(existing.id);
          return existing;
        }
        const updated = await updateProjectById(tx, existing.id, {
          next_step: input.next_step,
        });
        await insertEvent(
          tx,
          existing.id,
          'next_step_changed',
          { from: existing.next_step, to: input.next_step },
          input.actor,
        );
        liveTracker.beat(existing.id);
        return updated;
      });
    },
  };
}
```

- [ ] **Step 5: Write `apps/api/tests/services/agent-projects.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { makeAgentProjects } from '../../src/services/agent-projects.js';
import { schema } from '@foundry/db';
import { eq } from 'drizzle-orm';

describe('agent-projects service', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  const svc = () => makeAgentProjects({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });

  it('upsert creates a project + emits created event', async () => {
    const project = await svc().upsert({
      path: '/test/new-project',
      name: 'New Project',
      summary: 'a summary',
      actor: 'agent:test',
    });
    expect(project.slug).toBe('new-project');
    expect(project.status).toBe('active');

    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, project.id));
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('created');
  });

  it('upsert with existing path updates tracked fields + emits per-field events', async () => {
    await svc().upsert({
      path: '/test/update-me',
      name: 'Update Me',
      summary: 'first',
      actor: 'agent:test',
    });
    const updated = await svc().upsert({
      path: '/test/update-me',
      name: 'Update Me',
      summary: 'second',
      status: 'blocked',
      actor: 'agent:test',
    });
    expect(updated.summary).toBe('second');
    expect(updated.status).toBe('blocked');

    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, updated.id));
    const kinds = events.map((e) => e.kind).sort();
    expect(kinds).toEqual(['created', 'status_changed', 'summary_changed']);
  });

  it('slug collisions append -2', async () => {
    await svc().upsert({
      path: '/test/slug1',
      name: 'Collide',
      summary: 's',
      actor: 'agent:test',
    });
    const second = await svc().upsert({
      path: '/test/slug2',
      name: 'Collide',
      summary: 's',
      actor: 'agent:test',
    });
    expect(second.slug).toBe('collide-2');
  });

  it('setStatus emits status_changed and updates row', async () => {
    const created = await svc().upsert({
      path: '/test/setstatus',
      name: 'SetStatus',
      summary: 's',
      actor: 'agent:test',
    });
    const updated = await svc().setStatus({
      path: '/test/setstatus',
      status: 'paused',
      note: 'taking a break',
      actor: 'agent:test',
    });
    expect(updated.status).toBe('paused');
    expect(updated.status_note).toBe('taking a break');

    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, created.id));
    expect(events.map((e) => e.kind).sort()).toEqual(['created', 'status_changed']);
  });

  it('setStatus is a no-op when status unchanged', async () => {
    const created = await svc().upsert({
      path: '/test/noop',
      name: 'NoOp',
      summary: 's',
      status: 'active',
      actor: 'agent:test',
    });
    await svc().setStatus({
      path: '/test/noop',
      status: 'active',
      actor: 'agent:test',
    });
    const events = await stack.app.deps.db.db
      .select()
      .from(schema.projectEvents)
      .where(eq(schema.projectEvents.project_id, created.id));
    expect(events).toHaveLength(1); // only created, no status_changed
  });

  it('heartbeat throws NOT_FOUND for unknown path', async () => {
    await expect(svc().heartbeat('/never/seen')).rejects.toThrow(/no project at path/);
  });

  it('setNextStep emits next_step_changed', async () => {
    await svc().upsert({
      path: '/test/nextstep',
      name: 'NextStep',
      summary: 's',
      actor: 'agent:test',
    });
    const updated = await svc().setNextStep({
      path: '/test/nextstep',
      next_step: 'write tests',
      actor: 'agent:test',
    });
    expect(updated.next_step).toBe('write tests');
  });
});
```

- [ ] **Step 6: Run + commit**

```bash
npm test --workspace @foundry/api
git add packages/db/src/queries packages/db/src/index.ts apps/api/src/services/agent-projects.ts apps/api/tests/services/agent-projects.test.ts
git commit -m "feat(api): agent-projects service (upsert/heartbeat/setStatus/setNextStep)

Service-layer functions that do path lookup, slug generation with collision
handling, tracked-field diffing for per-field event emission, and liveness
beat after each call. All write paths run in a transaction. Tests use a
real Postgres test schema and assert event rows match field changes."
```

---

## Task 5: agent-decisions service + queries (TDD)

**Files:**
- Create: `packages/db/src/queries/decisions.ts`
- Create: `apps/api/src/services/agent-decisions.ts`
- Create: `apps/api/tests/services/agent-decisions.test.ts`

- [ ] **Step 1: Write `packages/db/src/queries/decisions.ts`**

```typescript
import { eq, and, isNull, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';

export type DecisionRow = typeof schema.projectDecisions.$inferSelect;
export type DecisionInsert = typeof schema.projectDecisions.$inferInsert;

export async function insertDecision(
  tx: NodePgDatabase<typeof schema>,
  values: DecisionInsert,
): Promise<DecisionRow> {
  const rows = await tx.insert(schema.projectDecisions).values(values).returning();
  return rows[0]!;
}

export async function findDecisionById(
  db: NodePgDatabase<typeof schema>,
  id: string,
): Promise<DecisionRow | undefined> {
  const rows = await db
    .select()
    .from(schema.projectDecisions)
    .where(eq(schema.projectDecisions.id, id))
    .limit(1);
  return rows[0];
}

export async function listDecisionsByProject(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
  opts: { currentOnly?: boolean } = {},
): Promise<DecisionRow[]> {
  const where = opts.currentOnly
    ? and(eq(schema.projectDecisions.project_id, projectId), isNull(schema.projectDecisions.superseded_by))
    : eq(schema.projectDecisions.project_id, projectId);
  return db
    .select()
    .from(schema.projectDecisions)
    .where(where)
    .orderBy(desc(schema.projectDecisions.made_at));
}

export async function markDecisionSuperseded(
  tx: NodePgDatabase<typeof schema>,
  priorId: string,
  newId: string,
): Promise<void> {
  await tx
    .update(schema.projectDecisions)
    .set({ superseded_by: newId })
    .where(eq(schema.projectDecisions.id, priorId));
}
```

Add to `packages/db/src/index.ts`: `export * from './queries/decisions.js';`

- [ ] **Step 2: Write `apps/api/src/services/agent-decisions.ts`**

```typescript
import type { DbClient } from '@foundry/db';
import {
  findProjectByPath,
  insertDecision,
  findDecisionById,
  markDecisionSuperseded,
  type DecisionRow,
} from '@foundry/db';
import type {
  AddDecisionInput,
  SupersedeDecisionInput,
} from '@foundry/shared';
import type { LiveTracker } from './live-tracker.js';
import { notFound, validation } from '../errors.js';

export interface AgentDecisionsDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

export function makeAgentDecisions(deps: AgentDecisionsDeps) {
  const { db, liveTracker } = deps;

  return {
    async add(input: AddDecisionInput): Promise<DecisionRow> {
      return db.db.transaction(async (tx) => {
        const project = await findProjectByPath(tx, input.path);
        if (!project) throw notFound(`no project at path ${input.path}`);
        const decision = await insertDecision(tx, {
          project_id: project.id,
          title: input.title,
          rationale: input.rationale,
          alternatives: input.alternatives ?? [],
          decision: input.decision ?? {},
          made_by: input.actor,
        });
        liveTracker.beat(project.id);
        return decision;
      });
    },

    async supersede(input: SupersedeDecisionInput): Promise<DecisionRow> {
      return db.db.transaction(async (tx) => {
        const project = await findProjectByPath(tx, input.path);
        if (!project) throw notFound(`no project at path ${input.path}`);
        const prior = await findDecisionById(tx, input.prior_id);
        if (!prior) throw notFound(`no decision with id ${input.prior_id}`);
        if (prior.project_id !== project.id) {
          throw validation('prior decision belongs to a different project');
        }
        if (prior.superseded_by !== null) {
          throw validation('prior decision is already superseded');
        }
        const newDecision = await insertDecision(tx, {
          project_id: project.id,
          title: input.title,
          rationale: input.rationale,
          alternatives: input.alternatives ?? [],
          decision: input.decision ?? {},
          made_by: input.actor,
        });
        await markDecisionSuperseded(tx, input.prior_id, newDecision.id);
        liveTracker.beat(project.id);
        return newDecision;
      });
    },
  };
}
```

- [ ] **Step 3: Write `apps/api/tests/services/agent-decisions.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { makeAgentProjects } from '../../src/services/agent-projects.js';
import { makeAgentDecisions } from '../../src/services/agent-decisions.js';

describe('agent-decisions service', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  const projects = () => makeAgentProjects({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });
  const decisions = () => makeAgentDecisions({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });

  it('add inserts a new decision', async () => {
    await projects().upsert({
      path: '/dec/p1',
      name: 'P1',
      summary: 's',
      actor: 'agent:test',
    });
    const d = await decisions().add({
      path: '/dec/p1',
      title: 'use Drizzle',
      rationale: 'lighter than Prisma',
      actor: 'agent:test',
    });
    expect(d.title).toBe('use Drizzle');
    expect(d.superseded_by).toBeNull();
  });

  it('supersede creates a new decision and links the prior', async () => {
    await projects().upsert({
      path: '/dec/p2',
      name: 'P2',
      summary: 's',
      actor: 'agent:test',
    });
    const prior = await decisions().add({
      path: '/dec/p2',
      title: 'use Prisma',
      rationale: 'familiar',
      actor: 'agent:test',
    });
    const replacement = await decisions().supersede({
      path: '/dec/p2',
      prior_id: prior.id,
      title: 'use Drizzle',
      rationale: 'pgvector support',
      actor: 'agent:test',
    });
    expect(replacement.superseded_by).toBeNull();

    // Re-fetch prior — it should now point at replacement.id
    const { db } = stack.app.deps;
    const { schema } = await import('@foundry/db');
    const { eq } = await import('drizzle-orm');
    const refetched = await db.db
      .select()
      .from(schema.projectDecisions)
      .where(eq(schema.projectDecisions.id, prior.id));
    expect(refetched[0]!.superseded_by).toBe(replacement.id);
  });

  it('supersede rejects when prior belongs to different project', async () => {
    await projects().upsert({ path: '/dec/p3', name: 'P3', summary: 's', actor: 'agent:test' });
    await projects().upsert({ path: '/dec/p4', name: 'P4', summary: 's', actor: 'agent:test' });
    const d = await decisions().add({
      path: '/dec/p3',
      title: 't',
      rationale: 'r',
      actor: 'agent:test',
    });
    await expect(
      decisions().supersede({
        path: '/dec/p4',
        prior_id: d.id,
        title: 't',
        rationale: 'r',
        actor: 'agent:test',
      }),
    ).rejects.toThrow(/different project/);
  });

  it('supersede rejects when prior is already superseded', async () => {
    await projects().upsert({ path: '/dec/p5', name: 'P5', summary: 's', actor: 'agent:test' });
    const d1 = await decisions().add({ path: '/dec/p5', title: 't1', rationale: 'r', actor: 'agent:test' });
    await decisions().supersede({
      path: '/dec/p5', prior_id: d1.id, title: 't2', rationale: 'r', actor: 'agent:test',
    });
    await expect(
      decisions().supersede({
        path: '/dec/p5', prior_id: d1.id, title: 't3', rationale: 'r', actor: 'agent:test',
      }),
    ).rejects.toThrow(/already superseded/);
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test --workspace @foundry/api
git add packages/db/src/queries/decisions.ts packages/db/src/index.ts apps/api/src/services/agent-decisions.ts apps/api/tests/services/agent-decisions.test.ts
git commit -m "feat(api): agent-decisions service (add + supersede with chain validation)"
```

---

## Task 6: agent-todos + agent-notes services + queries (TDD)

**Files:**
- Create: `packages/db/src/queries/todos.ts`, `packages/db/src/queries/notes.ts`
- Create: `apps/api/src/services/agent-todos.ts`, `apps/api/src/services/agent-notes.ts`
- Create: `apps/api/tests/services/agent-todos.test.ts`, `apps/api/tests/services/agent-notes.test.ts`

Follow the same pattern as Tasks 4-5: query helpers, service factory, integration tests that go through the test stack.

**Queries:**
- `insertTodo`, `findTodoById`, `updateTodoStatus`, `listTodosByProject` (grouped by status optional)
- `insertNote`, `listNotesByProject`

**Service responsibilities:**
- `agent-todos.add({path, text, actor})` → resolve path, insert, beat
- `agent-todos.update(todoId, status)` → find by id, validate it belongs to a project (no path check needed since FK enforces), update status (set completed_at when status='done'), beat project
- `agent-notes.add({path, body, author})` → resolve path, insert, beat

**Test coverage:**
- Happy paths
- 404 for unknown path / unknown todo_id
- Todo status transitions: open → in_progress → done sets completed_at; cancelled doesn't
- Note body retention (markdown stored as-is)

- [ ] **Step 1**: Implement queries (≤50 LoC each).
- [ ] **Step 2**: Implement services (≤50 LoC each).
- [ ] **Step 3**: Implement tests (≥4 cases each).
- [ ] **Step 4**: Run + commit (`feat(api): agent-todos + agent-notes services`).

---

## Task 7: agent.get service (the "remind me where I am" call) (TDD)

**Files:**
- Create: `packages/db/src/queries/timeline.ts`
- Create: `apps/api/src/services/agent-get.ts`
- Create: `apps/api/tests/services/agent-get.test.ts`

The `get` call returns:
```typescript
{
  project: ProjectRow,
  recent_events: ProjectEvent[],   // last 10 by occurred_at desc
  open_todos: Todo[],              // status in (open, in_progress)
  current_decisions: Decision[],    // superseded_by IS NULL
  recent_notes: Note[],            // last 5 by created_at desc
}
```

- [ ] **Step 1: `packages/db/src/queries/timeline.ts`**

```typescript
import { eq, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';

export async function listRecentEvents(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
  limit: number,
) {
  return db
    .select()
    .from(schema.projectEvents)
    .where(eq(schema.projectEvents.project_id, projectId))
    .orderBy(desc(schema.projectEvents.occurred_at))
    .limit(limit);
}
```

- [ ] **Step 2: `apps/api/src/services/agent-get.ts`**

```typescript
import type { DbClient } from '@foundry/db';
import {
  findProjectByPath,
  listRecentEvents,
  listDecisionsByProject,
  listOpenTodosByProject,    // from queries/todos.ts (Task 6)
  listRecentNotesByProject,  // from queries/notes.ts (Task 6)
} from '@foundry/db';
import type { LiveTracker } from './live-tracker.js';
import { notFound } from '../errors.js';

export interface AgentGetDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

export function makeAgentGet(deps: AgentGetDeps) {
  const { db, liveTracker } = deps;
  return {
    async get(path: string) {
      const project = await findProjectByPath(db.db, path);
      if (!project) throw notFound(`no project at path ${path}`);
      const [recent_events, open_todos, current_decisions, recent_notes] = await Promise.all([
        listRecentEvents(db.db, project.id, 10),
        listOpenTodosByProject(db.db, project.id),
        listDecisionsByProject(db.db, project.id, { currentOnly: true }),
        listRecentNotesByProject(db.db, project.id, 5),
      ]);
      liveTracker.beat(project.id);
      return { project, recent_events, open_todos, current_decisions, recent_notes };
    },
  };
}
```

- [ ] **Step 3**: Test that seeds a project, 2 decisions (1 superseded), 3 todos (1 done), 2 notes, 4 events → confirms the get response has the right counts and ordering.

- [ ] **Step 4**: Commit (`feat(api): agent.get composite query for "remind me where I am"`).

---

## Task 8: Agent route group — REST routes mounted under `/v1/agent/*` (TDD)

**Files:**
- Create: `apps/api/src/routes/agent/upsert.ts`, `heartbeat.ts`, `status.ts`, `next-step.ts`, `decisions.ts`, `todos.ts`, `notes.ts`, `get.ts`, `index.ts`
- Modify: `apps/api/src/server.ts` to register the agent route group at `/v1/agent`
- Create: `apps/api/tests/routes/agent-upsert.test.ts`, `apps/api/tests/routes/agent-flow.test.ts`

Each route is a thin adapter that:
1. Uses zod schema from `@foundry/shared` as request body validation
2. Instantiates the service via `app.deps`
3. Calls the service method
4. Returns the result (Fastify serializes JSON)

Example (`apps/api/src/routes/agent/upsert.ts`):

```typescript
import type { FastifyInstance } from 'fastify';
import { upsertProjectInputSchema, projectSchema } from '@foundry/shared';
import { makeAgentProjects } from '../../services/agent-projects.js';

export async function upsertRoute(app: FastifyInstance) {
  app.post('/upsert', {
    schema: {
      body: upsertProjectInputSchema,
      response: { 200: projectSchema },
    },
  }, async (req) => {
    const svc = makeAgentProjects({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.upsert(req.body);
  });
}
```

`apps/api/src/routes/agent/index.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { upsertRoute } from './upsert.js';
import { heartbeatRoute } from './heartbeat.js';
// ... import all
export async function agentRoutes(app: FastifyInstance) {
  await app.register(upsertRoute, { prefix: '/projects' });
  await app.register(heartbeatRoute, { prefix: '/projects' });
  // ... register all
}
```

In `server.ts`:
```typescript
import { agentRoutes } from './routes/agent/index.js';
// ...
app.register(agentRoutes, { prefix: '/v1/agent' });
```

- [ ] **Step 1**: Write all 8 route files.
- [ ] **Step 2**: Register the route group in `server.ts`.
- [ ] **Step 3**: Write `agent-upsert.test.ts` — tests each endpoint via `app.inject()`:
  - POST /v1/agent/projects/upsert with valid input returns 200 + project shape
  - Missing required field returns 400 VALIDATION_FAILED
  - Path with null byte returns 400
  - Subsequent upsert with same path returns the updated row
- [ ] **Step 4**: Write `agent-flow.test.ts` — an end-to-end multi-call test:
  ```
  1. POST upsert /test/flow → creates project
  2. POST status active→blocked
  3. POST add decision
  4. POST add todo
  5. PATCH update todo to done
  6. POST add note
  7. POST get → response has 1 project, ≥5 events, 1 decision, 1 todo (done), 1 note
  ```
- [ ] **Step 5**: Run + commit (`feat(api): agent REST route group at /v1/agent/*`).

---

## Task 9: Dashboard service + read routes (TDD)

**Files:**
- Create: `apps/api/src/services/dashboard.ts`
- Create: `apps/api/src/routes/dashboard/list.ts`, `detail.ts`, `timeline.ts`, `aspects.ts`, `index.ts`
- Modify: `apps/api/src/server.ts` to register dashboard routes at `/v1`
- Create: `apps/api/tests/routes/dashboard-list.test.ts`, `dashboard-detail.test.ts`

`dashboard.ts` exposes:
- `list({ status?, search?, sort?, includeArchived })` → returns rows with `live` (from liveTracker) + `decay` (from computeDecay) attached
- `getDetailBySlug(slug)` → project row
- `timeline(slug)` → merged events + decisions + todos + notes, sorted desc by occurred_at
- `decisionsBySlug(slug)`, `todosBySlug(slug)`, `notesBySlug(slug)`

The `list` query is the heaviest one — sort by `(pinned DESC, updated_at DESC)`, optional WHERE on status and `archived = false`, optional fuzzy match using `pg_trgm` (`name ILIKE '%' || $1 || '%'` or `name % $1` with threshold). For v1 use `ILIKE` — pg_trgm index makes it acceptable.

Route bodies are 3-5 lines each — extract query params, call the service, return the result.

- [ ] **Step 1**: Write the dashboard service (single file, ~150 LoC).
- [ ] **Step 2**: Write 6 route files (one each: list, detail, timeline, decisions, todos, notes).
- [ ] **Step 3**: Register the group in server.ts.
- [ ] **Step 4**: Write `dashboard-list.test.ts`:
  - Empty DB → returns `[]`
  - 3 projects (active, paused, done) → list returns 3, sorted by updated_at
  - Filter `status=active` returns only active
  - `include_archived=false` (default) excludes archived
  - Pinned project sorts first
  - Each row has `live: boolean` and `decay: 'fresh'|'stale'|'fossil'`
- [ ] **Step 5**: Write `dashboard-detail.test.ts`:
  - GET /v1/projects/:slug — returns project
  - Unknown slug → 404
  - GET /v1/projects/:slug/timeline — returns merged stream
  - GET aspect routes return correct shape
- [ ] **Step 6**: Commit (`feat(api): dashboard read routes for /v1/projects/*`).

---

## Task 10: Human flags + delete (TDD)

**Files:**
- Create: `apps/api/src/services/flags.ts`
- Create: `apps/api/src/routes/dashboard/flags.ts`, `delete.ts`
- Modify: `apps/api/src/routes/dashboard/index.ts` to register them
- Create: `apps/api/tests/routes/dashboard-flags.test.ts`

`flags.ts`:
```typescript
export function makeFlags(deps: { db: DbClient }) {
  return {
    async patch(slug: string, input: PatchFlagsInput): Promise<ProjectRow> {
      return deps.db.db.transaction(async (tx) => {
        const project = await findProjectBySlug(tx, slug);
        if (!project) throw notFound(`no project with slug ${slug}`);
        const patch: Partial<ProjectInsert> = {};
        for (const key of ['pinned', 'archived', 'needs_review', 'user_notes'] as const) {
          if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = input[key];
        }
        if (Object.keys(patch).length === 0) return project;
        const updated = await updateProjectById(tx, project.id, patch);
        await insertEvent(tx, project.id, 'human_flag_changed', {
          flag: Object.keys(patch)[0],
          from: project[Object.keys(patch)[0] as keyof typeof project],
          to: updated[Object.keys(patch)[0] as keyof typeof updated],
        }, 'human:joeyang');
        return updated;
      });
    },
    async delete(slug: string): Promise<void> {
      const n = await deleteProjectBySlug(deps.db.db, slug);
      if (n === 0) throw notFound(`no project with slug ${slug}`);
    },
  };
}
```

**Caveat:** If multiple flags change in one PATCH, emit one event per changed flag, not one combined event. Adjust the loop to emit multiple events.

- [ ] **Step 1**: Implement flags service with multi-flag event emission.
- [ ] **Step 2**: Implement routes (PATCH /v1/projects/:slug/flags, DELETE /v1/projects/:slug).
- [ ] **Step 3**: Tests:
  - Toggle pinned → row updates + event row
  - PATCH with multiple flags → multiple event rows
  - Empty PATCH body → no-op, no events
  - PATCH unknown slug → 404
  - DELETE removes project AND cascades to child rows
- [ ] **Step 4**: Commit (`feat(api): human flags PATCH + project DELETE`).

---

## Task 11: apps/mcp library workspace + Fastify plugin

**Files:**
- Create: `apps/mcp/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `apps/mcp/src/index.ts`, `apps/mcp/src/plugin.ts`, `apps/mcp/src/tools.ts`
- Create: `apps/mcp/tests/plugin.test.ts`
- Modify: `apps/api/src/server.ts` to mount the MCP plugin at `/mcp`

**Scaffold `package.json`:**

```json
{
  "name": "@foundry/mcp",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@foundry/shared": "*",
    "@foundry/db": "*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "fastify": "^5.0.0"
  }
}
```

`tsconfig.json` — same shape as others (no `rootDir`).

**`src/tools.ts`** — defines the tool→handler mapping:

```typescript
import type { FastifyInstance } from 'fastify';
import {
  upsertProjectInputSchema,
  setStatusInputSchema,
  setNextStepInputSchema,
  addDecisionInputSchema,
  supersedeDecisionInputSchema,
  addTodoInputSchema,
  updateTodoInputSchema,
  addNoteInputSchema,
} from '@foundry/shared';
import { z } from 'zod';
import { makeAgentProjects } from '@foundry/api/services/agent-projects.js';
// ... import other services

const heartbeatInputSchema = z.object({ path: z.string().min(1) });
const getInputSchema = z.object({ path: z.string().min(1) });
const updateTodoToolInputSchema = z.object({
  todo_id: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']),
});

export function buildTools(app: FastifyInstance) {
  return [
    {
      name: 'upsert_project',
      description: 'Register or update a project by filesystem path.',
      inputSchema: upsertProjectInputSchema,
      handler: (input: unknown) => {
        const parsed = upsertProjectInputSchema.parse(input);
        return makeAgentProjects({ db: app.deps.db, liveTracker: app.deps.liveTracker }).upsert(parsed);
      },
    },
    // ... 9 more tools following the same shape
  ];
}
```

**`src/plugin.ts`** — Fastify plugin that exposes tools as MCP-shaped HTTP endpoints. For v1 minimum: a simple POST `/mcp/tools/:name` that takes the tool input and returns the result. (Full MCP transport with SSE can come later; for an apps/mcp library this is enough to be MCP-shaped.)

```typescript
import type { FastifyInstance } from 'fastify';
import { buildTools } from './tools.js';

export async function mcpPlugin(app: FastifyInstance) {
  const tools = buildTools(app);
  const byName = new Map(tools.map((t) => [t.name, t]));

  app.get('/tools', async () => ({
    tools: tools.map(({ name, description }) => ({ name, description })),
  }));

  app.post<{ Params: { name: string }; Body: unknown }>('/tools/:name', async (req, reply) => {
    const tool = byName.get(req.params.name);
    if (!tool) return reply.status(404).send({ error: 'NOT_FOUND', message: `tool ${req.params.name}` });
    return tool.handler(req.body);
  });
}
```

**`src/index.ts`:**

```typescript
export { mcpPlugin } from './plugin.js';
```

**`apps/api/src/server.ts`** — register:

```typescript
import { mcpPlugin } from '@foundry/mcp';
// ...
app.register(mcpPlugin, { prefix: '/mcp' });
```

**Test** (`apps/mcp/tests/plugin.test.ts`):

- GET `/mcp/tools` returns array including `upsert_project`, `heartbeat`, `set_status`, etc. (10 tools total)
- POST `/mcp/tools/upsert_project` with valid input creates the project (verify by then SELECT from projects)
- POST with invalid input returns 400
- POST `/mcp/tools/unknown` returns 404

- [ ] **Step 1**: Scaffold workspace files.
- [ ] **Step 2**: Implement tools.ts (all 10).
- [ ] **Step 3**: Implement plugin.ts.
- [ ] **Step 4**: Wire into apps/api server.ts.
- [ ] **Step 5**: Tests.
- [ ] **Step 6**: Commit (`feat(mcp): Fastify plugin exposing 10 agent tools at /mcp/tools/*`).

---

## Verification — Plan 2 complete

- [ ] `npm test` from repo root passes all workspaces (~200+ tests across shared/db/api/mcp)
- [ ] `npm run typecheck --workspaces` exits 0
- [ ] Server starts: `npm run dev --workspace @foundry/api` and curl `http://localhost:5380/v1/healthz` returns `{status:'ok'}`
- [ ] Full agent flow exerciseable via curl:
  ```bash
  curl -X POST http://localhost:5380/v1/agent/projects/upsert -H content-type:application/json \
    -d '{"path":"/tmp/test","name":"test","summary":"smoke","actor":"agent:test"}'
  curl http://localhost:5380/v1/projects
  ```
- [ ] MCP tools list: `curl http://localhost:5380/mcp/tools` returns 10 tools

---

## What's NOT in Plan 2

- Frontend (Plan 3)
- Real MCP transport via stdio (the HTTP-shaped `/mcp/tools/*` is intentional — full MCP SDK transport wiring is Plan 3 polish or v2)
- Bearer-token auth (deferred per spec)
- SSE push for dashboard live updates (Plan 3 polling is sufficient)
- Semantic search wiring (the embedding column exists but no pipeline; v2)
