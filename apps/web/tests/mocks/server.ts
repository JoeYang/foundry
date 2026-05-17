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
