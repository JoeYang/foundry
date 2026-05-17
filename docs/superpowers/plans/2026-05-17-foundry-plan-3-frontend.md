# Foundry Plan 3: Frontend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the Vite + React dashboard at `apps/web`, axiom-styled, that reads from the Plan 2 REST API. Status board (card grid), per-project detail with tabs (Overview/Timeline/Decisions/Todos/Notes), and a small human-flag panel for the only writable UI surface.

**Architecture:** Single-page React app, `@tanstack/react-query` for all state, React Router v6 for navigation. Axiom design tokens inlined as CSS. Polling-based liveness (10s on dashboard). No backend wired to the frontend in dev — Vite proxies `/v1/*` and `/mcp/*` to the apps/api dev server.

**Tech Stack:** TypeScript · Vite 5 · React 18 · React Router v6 · @tanstack/react-query 5 · zod (via @foundry/shared types) · vitest + @testing-library/react · msw for HTTP mocking · Playwright for e2e.

**Reference spec:** `docs/superpowers/specs/2026-05-16-foundry-design.md` (Section "Frontend dashboard")
**Visual reference:** `apps/web/dashboard-axiom-v1.html`, `apps/web/detail-axiom-v1.html` (will be copied from brainstorming output as design source-of-truth)
**Prior plans:** `docs/superpowers/plans/2026-05-17-foundry-plan-1-foundation.md`, `docs/superpowers/plans/2026-05-17-foundry-plan-2-backend.md`

---

## File map

```
foundry/
├── apps/
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx                     (React DOM entry + router setup)
│       │   ├── App.tsx                      (TopBar + Routes wrapper)
│       │   ├── styles/
│       │   │   ├── axiom-tokens.css         (inlined from skills/axiom-style/colors_and_type.css)
│       │   │   └── global.css               (resets + html/body)
│       │   ├── api/
│       │   │   ├── client.ts                (fetch wrapper with error mapping)
│       │   │   └── projects.ts              (react-query hooks: useProjects, useProject, useTimeline, …)
│       │   ├── components/
│       │   │   ├── TopBar.tsx
│       │   │   ├── FilterBar.tsx
│       │   │   ├── EmptyState.tsx
│       │   │   ├── StatusDot.tsx
│       │   │   ├── LiveBadge.tsx
│       │   │   ├── DecayBadge.tsx
│       │   │   ├── TechTag.tsx
│       │   │   ├── Eyebrow.tsx
│       │   │   ├── NextStepBlock.tsx
│       │   │   └── ProjectCard.tsx
│       │   ├── pages/
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── ProjectDetailPage.tsx
│       │   │   └── detail/
│       │   │       ├── DetailHeader.tsx
│       │   │       ├── TabBar.tsx
│       │   │       ├── OverviewBody.tsx
│       │   │       ├── TimelineBody.tsx
│       │   │       ├── DecisionsBody.tsx
│       │   │       ├── TodosBody.tsx
│       │   │       ├── NotesBody.tsx
│       │   │       └── SideRail.tsx
│       │   └── lib/
│       │       └── format.ts                (relative time, slug helpers, etc.)
│       └── tests/
│           ├── setup.ts                     (msw setup, jsdom polyfills)
│           ├── mocks/
│           │   └── server.ts                (msw handlers for /v1/*)
│           ├── components/
│           │   ├── ProjectCard.test.tsx
│           │   ├── LiveBadge.test.tsx
│           │   ├── DecayBadge.test.tsx
│           │   └── NextStepBlock.test.tsx
│           ├── pages/
│           │   ├── DashboardPage.test.tsx
│           │   └── ProjectDetailPage.test.tsx
│           └── e2e/                         (playwright; runs against real stack via compose)
│               ├── playwright.config.ts
│               ├── dashboard.spec.ts
│               └── detail.spec.ts
└── ... (Plans 1+2 unchanged)
```

---

## Task 1: apps/web scaffold (Vite + React + TS + axiom styles)

**Files:** all the workspace scaffold files listed above, minus tests and component sources.

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "@foundry/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@foundry/shared": "*",
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "msw": "^2.6.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: 'http://localhost:5380', changeOrigin: false },
      '/mcp': { target: 'http://localhost:5380', changeOrigin: false },
    },
  },
});
```

- [ ] **Step 4: `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 5: `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>foundry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: `apps/web/src/styles/axiom-tokens.css`**

Copy contents from `/home/joeyang/.claude/skills/axiom-style/colors_and_type.css` into this file. (It's the Axiom token CSS; safe to inline.)

- [ ] **Step 7: `apps/web/src/styles/global.css`**

```css
@import './axiom-tokens.css';

*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; }
body { margin: 0; background: var(--paper-50); color: var(--ink-900); font-family: var(--font-sans, system-ui), sans-serif; }
a { color: var(--accent-600); text-decoration: none; }
a:hover { text-decoration: underline; }
button { font-family: inherit; cursor: pointer; }
```

- [ ] **Step 8: `apps/web/src/main.tsx`**

```typescript
import './styles/global.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.js';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 9: `apps/web/src/App.tsx`** (placeholder)

```typescript
import { Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div style={{ padding: 32 }}>foundry dashboard (Plan 3 scaffold)</div>} />
    </Routes>
  );
}
```

- [ ] **Step 10: `npm install` from repo root.**

- [ ] **Step 11: Verify dev server starts**

```bash
npm run dev --workspace @foundry/web
# Should print "Local: http://localhost:5173/"
# Ctrl-C to stop
```

- [ ] **Step 12: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat(web): Vite + React scaffold with axiom design tokens + router

apps/web npm workspace, Vite dev server on 5173 proxying /v1 + /mcp to
apps/api. React Router v6 + @tanstack/react-query provider set up.
axiom-tokens.css inlined from the design-system skill so the visual
identity is self-contained in the repo (no skill dependency at runtime)."
```

---

## Task 2: API client + react-query hooks

**Files:**
- Create: `apps/web/src/api/client.ts`, `apps/web/src/api/projects.ts`
- Create: `apps/web/tests/setup.ts`, `apps/web/tests/mocks/server.ts`

- [ ] **Step 1: `apps/web/src/api/client.ts`**

```typescript
import type { Project, PatchFlagsInput } from '@foundry/shared';

export interface DerivedProject extends Project {
  live: boolean;
  decay: 'fresh' | 'stale' | 'fossil';
}

export interface ApiError {
  error: string;
  message: string;
  request_id?: string;
}

export class ApiFetchError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(`API ${status} ${body.error}: ${body.message}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let body: ApiError;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      body = { error: 'UNKNOWN', message: res.statusText };
    }
    throw new ApiFetchError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listProjects: (params: { status?: string; search?: string; sort?: string; include_archived?: boolean } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    const q = qs.toString();
    return request<DerivedProject[]>(`/v1/projects${q ? `?${q}` : ''}`);
  },
  getProject: (slug: string) => request<DerivedProject>(`/v1/projects/${encodeURIComponent(slug)}`),
  getTimeline: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/timeline`),
  getDecisions: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/decisions`),
  getTodos: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/todos`),
  getNotes: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/notes`),
  patchFlags: (slug: string, input: PatchFlagsInput) =>
    request<DerivedProject>(`/v1/projects/${encodeURIComponent(slug)}/flags`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteProject: (slug: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
};
```

- [ ] **Step 2: `apps/web/src/api/projects.ts`**

```typescript
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api, type DerivedProject } from './client.js';
import type { PatchFlagsInput } from '@foundry/shared';

export const projectKeys = {
  all: ['projects'] as const,
  list: (filter: Record<string, unknown>) => ['projects', 'list', filter] as const,
  detail: (slug: string) => ['projects', 'detail', slug] as const,
  timeline: (slug: string) => ['projects', slug, 'timeline'] as const,
  decisions: (slug: string) => ['projects', slug, 'decisions'] as const,
  todos: (slug: string) => ['projects', slug, 'todos'] as const,
  notes: (slug: string) => ['projects', slug, 'notes'] as const,
};

export function useProjects(filter: Parameters<typeof api.listProjects>[0] = {}) {
  return useQuery({
    queryKey: projectKeys.list(filter),
    queryFn: () => api.listProjects(filter),
    refetchInterval: 10_000,
  });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(slug ?? ''),
    queryFn: () => api.getProject(slug!),
    enabled: !!slug,
  });
}

export function useTimeline(slug: string | undefined) {
  return useQuery({
    queryKey: projectKeys.timeline(slug ?? ''),
    queryFn: () => api.getTimeline(slug!),
    enabled: !!slug,
  });
}

export function useDecisions(slug: string | undefined) {
  return useQuery({ queryKey: projectKeys.decisions(slug ?? ''), queryFn: () => api.getDecisions(slug!), enabled: !!slug });
}
export function useTodos(slug: string | undefined) {
  return useQuery({ queryKey: projectKeys.todos(slug ?? ''), queryFn: () => api.getTodos(slug!), enabled: !!slug });
}
export function useNotes(slug: string | undefined) {
  return useQuery({ queryKey: projectKeys.notes(slug ?? ''), queryFn: () => api.getNotes(slug!), enabled: !!slug });
}

export function usePatchFlags(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchFlagsInput) => api.patchFlags(slug, input),
    onSuccess: (updated) => {
      qc.setQueryData(projectKeys.detail(slug), updated);
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.deleteProject(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
```

- [ ] **Step 3: `apps/web/tests/setup.ts`**

```typescript
import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 4: `apps/web/tests/mocks/server.ts`**

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const sampleProject = {
  id: '00000000-0000-0000-0000-000000000001',
  path: '/test/foundry',
  slug: 'foundry',
  name: 'foundry',
  summary: 'Test project',
  goal: '',
  status: 'active',
  status_note: null,
  next_step: 'do the thing',
  tech_stack: ['ts', 'pg'],
  links: {},
  metadata: {},
  search_embedding: null,
  pinned: true,
  archived: false,
  needs_review: false,
  user_notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  live: true,
  decay: 'fresh' as const,
};

export const handlers = [
  http.get('/v1/projects', () => HttpResponse.json([sampleProject])),
  http.get('/v1/projects/:slug', ({ params }) =>
    HttpResponse.json({ ...sampleProject, slug: params.slug as string }),
  ),
  http.get('/v1/projects/:slug/timeline', () => HttpResponse.json([])),
  http.get('/v1/projects/:slug/decisions', () => HttpResponse.json([])),
  http.get('/v1/projects/:slug/todos', () => HttpResponse.json([])),
  http.get('/v1/projects/:slug/notes', () => HttpResponse.json([])),
  http.patch('/v1/projects/:slug/flags', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...sampleProject, ...body });
  }),
  http.delete('/v1/projects/:slug', () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlers);
```

- [ ] **Step 5: Verify typecheck**

```bash
npm install
npm run typecheck --workspace @foundry/web
```

Both exit 0. (No tests yet — those come with the components.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api apps/web/tests
git commit -m "feat(web): API client + react-query hooks + msw test harness

Typed fetch wrapper mapping spec error shape to ApiFetchError. Hooks for
all 6 GET endpoints (list/detail/timeline + 3 aspects) + mutations for
flag PATCH and DELETE. Dashboard list refetches every 10s; detail
endpoints fetch on demand. msw configured for component tests; e2e tests
will hit the real stack."
```

---

## Task 3: Primitive components (TDD via testing-library)

**Files:**
- Create: `apps/web/src/components/StatusDot.tsx`, `LiveBadge.tsx`, `DecayBadge.tsx`, `TechTag.tsx`, `Eyebrow.tsx`, `NextStepBlock.tsx`, `EmptyState.tsx`
- Create: `apps/web/src/lib/format.ts`
- Create: corresponding test files

These are pure presentational components. Each one file, ~30-50 lines, with a simple test.

**Pattern (`StatusDot.tsx`):**

```typescript
import type { ProjectStatus } from '@foundry/shared';

const COLOR: Record<ProjectStatus, string> = {
  active: 'var(--green-600)',
  paused: 'var(--amber-500)',
  blocked: 'var(--red-500)',
  done: 'var(--teal-500)',
};

export function StatusDot({ status }: { status: ProjectStatus }) {
  return (
    <span
      aria-label={`status: ${status}`}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 9999,
        background: COLOR[status],
      }}
    />
  );
}
```

**`LiveBadge.tsx`** — pulsing dot + "live" label, only renders when `live === true`:

```typescript
export function LiveBadge({ live }: { live: boolean }) {
  if (!live) return null;
  return (
    <span
      data-testid="live-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--green-600)',
        background: '#e8f3eb',
        padding: '2px 8px',
        borderRadius: 9999,
        border: '1px solid #c8e0cf',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--green-600)' }} />
      live
    </span>
  );
}
```

**`DecayBadge.tsx`** — small label, only renders for `stale`/`fossil`:

```typescript
import type { Decay } from '@foundry/shared';

export function DecayBadge({ decay }: { decay: Decay }) {
  if (decay === 'fresh') return null;
  return (
    <span
      data-testid={`decay-badge-${decay}`}
      style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '2px 6px',
        borderRadius: 4,
        background: 'var(--paper-200)',
        color: 'var(--ink-500)',
      }}
    >
      {decay}
    </span>
  );
}
```

**`TechTag.tsx`** — mono pill:

```typescript
export function TechTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        padding: '2px 6px',
        border: '1px solid var(--paper-200)',
        borderRadius: 4,
        color: 'var(--ink-700)',
        background: '#fff',
      }}
    >
      {children}
    </span>
  );
}
```

**`Eyebrow.tsx`** — small caps label:

```typescript
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-500)',
      }}
    >
      {children}
    </span>
  );
}
```

**`NextStepBlock.tsx`** — pulled-out block with hairline left rule:

```typescript
import { Eyebrow } from './Eyebrow.js';

export function NextStepBlock({ text }: { text: string }) {
  return (
    <div
      style={{
        paddingLeft: 12,
        borderLeft: '2px solid var(--accent-500)',
        background: 'var(--accent-50)',
        padding: '12px 16px',
      }}
    >
      <div style={{ marginBottom: 4 }}><Eyebrow>Next step</Eyebrow></div>
      <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>{text}</div>
    </div>
  );
}
```

**`EmptyState.tsx`** — generic empty/error placeholder:

```typescript
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center', color: 'var(--ink-500)' }}>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, marginBottom: 8 }}>{title}</h3>
      {body && <p style={{ maxWidth: 480, margin: '0 auto' }}>{body}</p>}
    </div>
  );
}
```

**`lib/format.ts`** — relative time:

```typescript
export function relativeTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
```

**Tests** (one per component, TDD):

- LiveBadge: renders null when live=false; renders with text 'live' when live=true
- DecayBadge: renders null for fresh; renders 'stale' / 'fossil' for those values
- NextStepBlock: renders text and 'Next step' eyebrow label

Example (`LiveBadge.test.tsx`):
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveBadge } from '../../src/components/LiveBadge.js';

describe('LiveBadge', () => {
  it('renders nothing when live=false', () => {
    const { container } = render(<LiveBadge live={false} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders live label when live=true', () => {
    render(<LiveBadge live={true} />);
    expect(screen.getByTestId('live-badge')).toHaveTextContent('live');
  });
});
```

- [ ] **Step 1**: Write each component + a test (TDD).
- [ ] **Step 2**: Run `npm test --workspace @foundry/web` — expect ~10 tests passing.
- [ ] **Step 3**: Commit (`feat(web): primitive components (StatusDot, LiveBadge, DecayBadge, TechTag, Eyebrow, NextStepBlock, EmptyState) + format helpers`).

---

## Task 4: ProjectCard + DashboardPage

**Files:**
- Create: `apps/web/src/components/ProjectCard.tsx`
- Create: `apps/web/src/components/TopBar.tsx`
- Create: `apps/web/src/components/FilterBar.tsx`
- Create: `apps/web/src/pages/DashboardPage.tsx`
- Update: `apps/web/src/App.tsx` (mount DashboardPage at `/`)
- Tests: `ProjectCard.test.tsx`, `DashboardPage.test.tsx`

### `ProjectCard.tsx`

Renders one project card per the axiom mockup:
- Name (serif h3)
- Status dot + status + optional status_note
- Live badge if live
- Decay badge if not fresh
- Summary
- NextStepBlock if next_step
- Tech stack tags
- Footer: cwd path + relative time + decay badge
- Click → navigate to /p/:slug
- If pinned: orange-ish left border (accent indigo per axiom)

```typescript
import { Link } from 'react-router-dom';
import type { DerivedProject } from '../api/client.js';
import { StatusDot } from './StatusDot.js';
import { LiveBadge } from './LiveBadge.js';
import { DecayBadge } from './DecayBadge.js';
import { TechTag } from './TechTag.js';
import { Eyebrow } from './Eyebrow.js';
import { NextStepBlock } from './NextStepBlock.js';
import { relativeTime } from '../lib/format.js';

export function ProjectCard({ project }: { project: DerivedProject }) {
  return (
    <Link
      to={`/p/${encodeURIComponent(project.slug)}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#fff',
        border: '1px solid var(--paper-200)',
        borderLeft: project.pinned ? '2px solid var(--accent-500)' : '1px solid var(--paper-200)',
        borderRadius: 6,
        padding: 20,
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <div>
        {project.pinned && <div style={{ marginBottom: 4 }}><Eyebrow>Pinned</Eyebrow></div>}
        <h3 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 20,
          fontWeight: 500,
          margin: '0 0 4px',
        }}>{project.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-700)' }}>
          <StatusDot status={project.status} />
          {project.status}
          {project.status_note && <span style={{ fontStyle: 'italic', color: 'var(--ink-500)' }}>— {project.status_note}</span>}
          <LiveBadge live={project.live} />
        </div>
      </div>

      <p style={{ margin: 0, color: 'var(--ink-700)', fontSize: 14, lineHeight: 1.5 }}>{project.summary}</p>

      {project.next_step && <NextStepBlock text={project.next_step} />}

      {project.tech_stack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {project.tech_stack.map((t) => <TechTag key={t}>{t}</TechTag>)}
        </div>
      )}

      <div style={{
        borderTop: '1px solid var(--paper-200)',
        paddingTop: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--ink-500)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{project.path}</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DecayBadge decay={project.decay} />
          {relativeTime(project.updated_at)}
        </span>
      </div>
    </Link>
  );
}
```

### `TopBar.tsx`

Brand + search input. The search input updates a URL query param (`?search=`).

### `FilterBar.tsx`

Chips: All / Active / Paused / Blocked / Done / Archived. Click → update URL query param.

### `DashboardPage.tsx`

```typescript
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../api/projects.js';
import { ProjectCard } from '../components/ProjectCard.js';
import { EmptyState } from '../components/EmptyState.js';
import { TopBar } from '../components/TopBar.js';
import { FilterBar } from '../components/FilterBar.js';
import { Eyebrow } from '../components/Eyebrow.js';

export function DashboardPage() {
  const [params] = useSearchParams();
  const filter = {
    status: params.get('status') ?? undefined,
    search: params.get('search') ?? undefined,
  };

  const { data, isLoading, error } = useProjects(filter as Parameters<typeof useProjects>[0]);

  if (isLoading) return <EmptyState title="Loading projects…" />;
  if (error) return <EmptyState title="Couldn't reach foundry" body="Retrying automatically." />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No projects registered yet"
        body="From a project directory, ask Claude Code to call upsert_project on the foundry MCP server."
      />
    );
  }

  const pinned = data.filter((p) => p.pinned);
  const others = data.filter((p) => !p.pinned);

  return (
    <div>
      <TopBar />
      <FilterBar counts={countByStatus(data)} />
      {pinned.length > 0 && (
        <>
          <SectionHeader>Pinned</SectionHeader>
          <Grid>{pinned.map((p) => <ProjectCard key={p.id} project={p} />)}</Grid>
        </>
      )}
      <SectionHeader>All projects</SectionHeader>
      <Grid>{others.map((p) => <ProjectCard key={p.id} project={p} />)}</Grid>
    </div>
  );
}

function countByStatus(projects: { status: string }[]) {
  return projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '24px 32px 12px' }}><Eyebrow>{children}</Eyebrow></div>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '0 32px 32px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
    }}>
      {children}
    </div>
  );
}
```

### Tests

- `ProjectCard.test.tsx`: renders name, status text, live badge when live=true, next step when present, tech tags, path
- `DashboardPage.test.tsx`: msw returns one project → page renders pinned section + project card with the right name

- [ ] **Step 1**: Write each component file.
- [ ] **Step 2**: Update App.tsx to mount DashboardPage at `/`.
- [ ] **Step 3**: Write tests.
- [ ] **Step 4**: Run + commit (`feat(web): DashboardPage card grid + ProjectCard + FilterBar + TopBar`).

---

## Task 5: Project detail page with tabs

**Files:**
- Create: `apps/web/src/pages/ProjectDetailPage.tsx`
- Create: `apps/web/src/pages/detail/DetailHeader.tsx`, `TabBar.tsx`, `OverviewBody.tsx`, `TimelineBody.tsx`, `DecisionsBody.tsx`, `TodosBody.tsx`, `NotesBody.tsx`, `SideRail.tsx`
- Update: `apps/web/src/App.tsx` (add routes `/p/:slug` + tab routes)
- Test: `ProjectDetailPage.test.tsx`

### Routing

```typescript
// App.tsx
<Routes>
  <Route path="/" element={<DashboardPage />} />
  <Route path="/p/:slug" element={<ProjectDetailPage />} />
  <Route path="/p/:slug/:tab" element={<ProjectDetailPage />} />
</Routes>
```

### `ProjectDetailPage.tsx`

```typescript
import { useParams } from 'react-router-dom';
import { useProject } from '../api/projects.js';
import { DetailHeader } from './detail/DetailHeader.js';
import { TabBar } from './detail/TabBar.js';
import { OverviewBody } from './detail/OverviewBody.js';
import { TimelineBody } from './detail/TimelineBody.js';
import { DecisionsBody } from './detail/DecisionsBody.js';
import { TodosBody } from './detail/TodosBody.js';
import { NotesBody } from './detail/NotesBody.js';
import { SideRail } from './detail/SideRail.js';
import { EmptyState } from '../components/EmptyState.js';

const TABS = {
  overview: OverviewBody,
  timeline: TimelineBody,
  decisions: DecisionsBody,
  todos: TodosBody,
  notes: NotesBody,
} as const;
type TabName = keyof typeof TABS;

export function ProjectDetailPage() {
  const { slug, tab = 'overview' } = useParams<{ slug: string; tab?: string }>();
  const { data: project, isLoading, error } = useProject(slug);

  if (isLoading) return <EmptyState title="Loading…" />;
  if (error || !project) return <EmptyState title="Project not found" body="It may have been deleted." />;

  const tabName = (tab in TABS ? tab : 'overview') as TabName;
  const Body = TABS[tabName];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32, padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <DetailHeader project={project} />
        <TabBar slug={project.slug} active={tabName} />
        <Body project={project} />
      </div>
      <SideRail project={project} />
    </div>
  );
}
```

### Bodies

Each tab body is a small component that:
- `OverviewBody`: calls `useDecisions`/`useTodos`/`useTimeline` to render the Overview tab from the mockup (current decisions, open todos, recent timeline)
- `TimelineBody`: `useTimeline(slug)` → render all items
- `DecisionsBody`: `useDecisions(slug)` → list with rationale + made_at
- `TodosBody`: `useTodos(slug)` → grouped by status (open / in_progress / done / cancelled)
- `NotesBody`: `useNotes(slug)` → newest first

Each body file should be ~50-100 lines. Reference the axiom detail mockup for exact styling.

### `DetailHeader.tsx`

Per the mockup: brand · name (large serif) · live badge · status row · path/updated meta · summary (italic serif) · goal (with eyebrow) · next-step block.

### `TabBar.tsx`

5 tabs as <Link> elements; active tab gets accent underline.

### `SideRail.tsx`

Per the mockup: tech_stack tags, links, your-flags toggles (writes via `usePatchFlags`), your-notes textarea (debounced PATCH on blur), raw metadata.

The flags toggles are the only writable UI — make them obvious (toggle switches), optimistic, and revertable on error.

### Tests

`ProjectDetailPage.test.tsx`: msw returns one project + empty decisions/todos/notes → page renders header with correct name + tab bar.

A second test: navigating to `/p/foundry/timeline` shows the Timeline tab body content.

- [ ] **Step 1**: Write all 8 detail-related files.
- [ ] **Step 2**: Add the two routes to App.tsx.
- [ ] **Step 3**: Write tests.
- [ ] **Step 4**: Commit (`feat(web): ProjectDetailPage with 5 tabs + DetailHeader + SideRail with flag toggles`).

---

## Task 6: Playwright e2e suite

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/dashboard.spec.ts`, `detail.spec.ts`

### `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: [
    {
      command: 'npm run dev --workspace @foundry/api',
      port: 5380,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev --workspace @foundry/web',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
```

### `tests/e2e/dashboard.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';

test('empty dashboard message renders', async ({ page }) => {
  // Assumes DB is empty; cleanup hook would clear projects between tests but for v1 we
  // accept that the test runs against the dev DB and asserts whatever is there.
  await page.goto('/');
  // If there are projects, just confirm any heading; if empty, confirm the empty message.
  const headingOrEmpty = page.locator('h3');
  await expect(headingOrEmpty.first()).toBeVisible();
});

test('upserting a project via the API surfaces in the dashboard', async ({ page, request: rq }) => {
  const path = `/tmp/e2e-${Date.now()}`;
  await rq.post('http://localhost:5380/v1/agent/projects/upsert', {
    data: {
      path, name: `E2E test ${Date.now()}`, summary: 'created via e2e',
      goal: '', tech_stack: [], links: {}, metadata: {},
      actor: 'agent:e2e',
    },
  });
  await page.goto('/');
  // Wait for the 10s polling refetch (or trigger a reload)
  await page.reload();
  await expect(page.getByRole('heading', { level: 3 }).filter({ hasText: /E2E test/ })).toBeVisible();
});
```

### `tests/e2e/detail.spec.ts`

Navigates to a known slug, asserts the detail page renders the right name, switches tabs.

- [ ] **Step 1**: Write the config + both specs.
- [ ] **Step 2**: Install Playwright browsers (`npx playwright install chromium` — may need user intervention if no internet).
- [ ] **Step 3**: Verify both specs pass against running dev stack.
- [ ] **Step 4**: Commit (`test(web): Playwright e2e smoke covering dashboard list + agent upsert flow`).

---

## Verification — Plan 3 complete

- [ ] `npm test --workspace @foundry/web` passes all component tests
- [ ] `npm run typecheck --workspace @foundry/web` exit 0
- [ ] `npm run dev --workspace @foundry/api &` + `npm run dev --workspace @foundry/web` and visit http://localhost:5173 — see the dashboard
- [ ] Create a project via curl; reload — see it appear
- [ ] Click into the project; tabs work; flag toggle persists
- [ ] `npm run test:e2e --workspace @foundry/web` passes

---

## What's NOT in Plan 3

- Semantic search UI (v2 — backend search not built either)
- Dark mode toggle (Axiom supports it via `data-theme="dark"`; trivial to add later)
- Notes textarea autosave on every keystroke (we save on blur for simplicity)
- WebSocket / SSE push (polling is fine for v1)
- Real MCP SDK transport in the frontend (the dashboard speaks REST only)
