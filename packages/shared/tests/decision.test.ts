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
  it('rejects empty rationale', () => {
    expect(() =>
      addDecisionInputSchema.parse({
        path: '/x',
        title: 't',
        rationale: '',
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
  it('rejects decision.links with javascript: scheme', () => {
    expect(() =>
      addDecisionInputSchema.parse({
        path: '/x',
        title: 't',
        rationale: 'r',
        actor: 'agent:c',
        decision: {
          links: [{ label: 'docs', url: 'javascript:alert(1)' }],
        },
      }),
    ).toThrow();
  });
  it('accepts decision.links with https: scheme', () => {
    expect(
      addDecisionInputSchema.parse({
        path: '/x',
        title: 't',
        rationale: 'r',
        actor: 'agent:c',
        decision: {
          links: [{ label: 'docs', url: 'https://example.com' }],
        },
      }),
    ).toBeDefined();
  });
  it('rejects path with null bytes', () => {
    expect(() =>
      addDecisionInputSchema.parse({
        path: '/foo\x00bar',
        title: 't',
        rationale: 'r',
        actor: 'agent:c',
      }),
    ).toThrow();
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
  it('rejects non-uuid prior_id', () => {
    expect(() =>
      supersedeDecisionInputSchema.parse({
        path: '/x',
        prior_id: 'not-a-uuid',
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
