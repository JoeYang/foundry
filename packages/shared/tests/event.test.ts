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
  it('rejects extra keys on created (strict)', () => {
    expect(() =>
      eventPayloadSchemas.created.parse({ extra: 'unexpected' }),
    ).toThrow();
  });

  it('validates summary_changed payload', () => {
    expect(
      eventPayloadSchemas.summary_changed.parse({ from: 'old', to: 'new' }),
    ).toBeDefined();
    expect(
      eventPayloadSchemas.summary_changed.parse({ from: null, to: 'first summary' }),
    ).toBeDefined();
  });

  it('validates goal_changed payload', () => {
    expect(
      eventPayloadSchemas.goal_changed.parse({ from: 'old', to: 'new' }),
    ).toBeDefined();
  });

  it('validates tech_stack_changed payload', () => {
    expect(
      eventPayloadSchemas.tech_stack_changed.parse({
        from: ['ts'],
        to: ['ts', 'pg'],
      }),
    ).toBeDefined();
    expect(() =>
      eventPayloadSchemas.tech_stack_changed.parse({ from: ['ts'], to: 'pg' }),
    ).toThrow();
  });

  it('validates links_changed payload', () => {
    expect(
      eventPayloadSchemas.links_changed.parse({
        from: { repo: 'https://x' },
        to: { repo: 'https://y' },
      }),
    ).toBeDefined();
  });

  it('validates human_flag_changed payload', () => {
    expect(
      eventPayloadSchemas.human_flag_changed.parse({ flag: 'pinned', from: false, to: true }),
    ).toBeDefined();
    expect(
      eventPayloadSchemas.human_flag_changed.parse({ flag: 'user_notes', from: null, to: 'hi' }),
    ).toBeDefined();
    expect(() =>
      eventPayloadSchemas.human_flag_changed.parse({ flag: 'unknown', from: false, to: true }),
    ).toThrow();
  });
});
