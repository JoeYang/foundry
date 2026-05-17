import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { relativeTime } from '../../src/lib/format.js';

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [10, '10s ago'],
    [120, '2m ago'],
    [60 * 60 * 3, '3h ago'],
    [60 * 60 * 24 * 5, '5d ago'],
    [60 * 60 * 24 * 60, '2mo ago'],
    [60 * 60 * 24 * 365 * 2, '2y ago'],
  ])('renders %is ago as %s', (secondsAgo, expected) => {
    const iso = new Date(Date.now() - secondsAgo * 1000).toISOString();
    expect(relativeTime(iso)).toBe(expected);
  });
});
