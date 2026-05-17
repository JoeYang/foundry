import { describe, it, expect } from 'vitest';
import { toSlug, ensureUniqueSlug } from '../../src/services/slug.js';

describe('toSlug', () => {
  it.each([
    ['foundry', 'foundry'],
    ['Foundry App', 'foundry-app'],
    ['My Project!', 'my-project'],
    ['   spaces   ', 'spaces'],
    ['under_scores', 'under-scores'],
    ['café', 'cafe'],
    ['', 'project'],
  ])('toSlug(%s) -> %s', (input, expected) => {
    expect(toSlug(input)).toBe(expected);
  });
});

describe('ensureUniqueSlug', () => {
  it('returns input if not taken', async () => {
    const out = await ensureUniqueSlug('foundry', async () => false);
    expect(out).toBe('foundry');
  });
  it('appends -2, -3, etc. on collisions', async () => {
    let calls = 0;
    const out = await ensureUniqueSlug('foundry', async (s) => {
      calls++;
      return s === 'foundry' || s === 'foundry-2';
    });
    expect(out).toBe('foundry-3');
    expect(calls).toBe(3);
  });
});
