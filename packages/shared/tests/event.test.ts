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
