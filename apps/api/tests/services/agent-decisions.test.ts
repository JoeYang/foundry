import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestStack } from '../helpers/test-server.js';
import { makeAgentProjects } from '../../src/services/agent-projects.js';
import { makeAgentDecisions } from '../../src/services/agent-decisions.js';
import { schema } from '@foundry/db';
import { eq } from 'drizzle-orm';

describe('agent-decisions service', () => {
  let stack: TestStack;
  beforeAll(async () => { stack = await startTestServer(); });
  afterAll(async () => { await stack.cleanup(); });

  const projects = () => makeAgentProjects({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });
  const decisions = () => makeAgentDecisions({ db: stack.app.deps.db, liveTracker: stack.app.deps.liveTracker });

  // Helper to satisfy UpsertProjectInput's strict type (defaults only apply via .parse())
  const mkProj = (path: string, name: string) => ({
    path,
    name,
    summary: 's',
    goal: '',
    tech_stack: [],
    links: {},
    metadata: {},
    actor: 'agent:test' as const,
  });

  it('add inserts a new decision', async () => {
    await projects().upsert(mkProj('/dec/p1', 'P1'));
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
    await projects().upsert(mkProj('/dec/p2', 'P2'));
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

    const refetched = await stack.app.deps.db.db
      .select()
      .from(schema.projectDecisions)
      .where(eq(schema.projectDecisions.id, prior.id));
    expect(refetched[0]!.superseded_by).toBe(replacement.id);
  });

  it('supersede rejects when prior belongs to different project', async () => {
    await projects().upsert(mkProj('/dec/p3', 'P3'));
    await projects().upsert(mkProj('/dec/p4', 'P4'));
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
    await projects().upsert(mkProj('/dec/p5', 'P5'));
    const d1 = await decisions().add({
      path: '/dec/p5', title: 't1', rationale: 'r', actor: 'agent:test',
    });
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
