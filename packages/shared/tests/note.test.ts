import { describe, it, expect } from 'vitest';
import { addNoteInputSchema, noteSchema } from '../src/note.js';

describe('addNoteInputSchema', () => {
  it('accepts path + body + author', () => {
    expect(
      addNoteInputSchema.parse({ path: '/x', body: 'hello', author: 'agent:c' }),
    ).toBeDefined();
  });
  it('rejects empty body', () => {
    expect(() =>
      addNoteInputSchema.parse({ path: '/x', body: '', author: 'agent:c' }),
    ).toThrow();
  });
  it('requires author with agent:/human: prefix', () => {
    expect(() =>
      addNoteInputSchema.parse({ path: '/x', body: 'b', author: 'bob' }),
    ).toThrow();
  });
});

describe('noteSchema', () => {
  it('parses a full row', () => {
    expect(
      noteSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        project_id: '00000000-0000-0000-0000-000000000002',
        body: 'b',
        author: 'human:joeyang',
        created_at: new Date().toISOString(),
      }),
    ).toBeDefined();
  });
});
