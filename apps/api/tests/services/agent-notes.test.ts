import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { makeAgentProjects } from '../../src/services/agent-projects.js';
import { makeAgentNotes } from '../../src/services/agent-notes.js';

const mkProj = (path: string, name: string) => ({
  path, name, summary: 's', goal: '', tech_stack: [], links: {}, metadata: {},
  actor: 'agent:test' as const,
});

describe('agent-notes service', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  const projects = () => makeAgentProjects({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });
  const notes = () => makeAgentNotes({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });

  it('add inserts a markdown note', async () => {
    await projects().upsert(mkProj('/notes/p1', 'P1'));
    const n = await notes().add({
      path: '/notes/p1',
      body: '# header\n\nsome **markdown** text',
      author: 'human:joeyang',
    });
    expect(n.body).toBe('# header\n\nsome **markdown** text');
    expect(n.author).toBe('human:joeyang');
  });

  it('add throws NOT_FOUND for unknown path', async () => {
    await expect(notes().add({
      path: '/never', body: 'x', author: 'agent:test',
    })).rejects.toThrow(/no project at path/);
  });

  it('multiple notes preserved (append-only)', async () => {
    await projects().upsert(mkProj('/notes/p2', 'P2'));
    await notes().add({ path: '/notes/p2', body: 'first', author: 'human:joeyang' });
    await notes().add({ path: '/notes/p2', body: 'second', author: 'human:joeyang' });

    const { schema } = await import('@foundry/db');
    const { eq } = await import('drizzle-orm');
    const project = (await stack.app.deps.db.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.slug, 'p2'))
      .limit(1))[0]!;
    const all = await stack.app.deps.db.db
      .select()
      .from(schema.projectNotes)
      .where(eq(schema.projectNotes.project_id, project.id));
    expect(all).toHaveLength(2);
  });
});
