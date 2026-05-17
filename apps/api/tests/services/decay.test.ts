import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeDecay } from '../../src/services/decay.js';

describe('computeDecay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const now = new Date('2026-05-17T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  it.each([
    ['done',     daysAgo(89),  'fresh'],
    ['done',     daysAgo(91),  'stale'],
    ['done',     daysAgo(180), 'stale'],
    ['active',   daysAgo(91),  'fresh'],
    ['active',   daysAgo(366), 'fossil'],
    ['done',     daysAgo(366), 'fossil'],
    ['paused',   daysAgo(366), 'fossil'],
    ['blocked',  daysAgo(10),  'fresh'],
  ] as const)('status=%s updated=%s decay=%s', (status, updated, expected) => {
    expect(computeDecay(status, updated)).toBe(expected);
  });
});
