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
  it('rejects path with null bytes', () => {
    expect(() =>
      addTodoInputSchema.parse({ path: '/foo\x00bar', text: 'do thing', actor: 'agent:c' }),
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
