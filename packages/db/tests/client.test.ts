import { describe, it, expect } from 'vitest';
import { createDbClient } from '../src/client.js';

describe('createDbClient', () => {
  it('returns an object with db and pool when given a URL', () => {
    const client = createDbClient('postgres://x:y@localhost:5433/foundry');
    expect(client).toHaveProperty('db');
    expect(client).toHaveProperty('pool');
    expect(typeof client.close).toBe('function');
    // Don't actually connect — the URL is fake. Just verify shape.
  });
  it('throws when given an empty URL', () => {
    expect(() => createDbClient('')).toThrow();
  });
  it('reads from env when no URL passed and DB_URL_APP is set', () => {
    process.env.DB_URL_APP = 'postgres://x:y@localhost:5433/foundry';
    const client = createDbClient();
    expect(client).toHaveProperty('db');
    delete process.env.DB_URL_APP;
  });
  it('throws when no URL passed and no env var set', () => {
    delete process.env.DB_URL_APP;
    expect(() => createDbClient()).toThrow(/DB_URL_APP/);
  });
});
