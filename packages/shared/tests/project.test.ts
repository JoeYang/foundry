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
