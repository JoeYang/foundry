import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveTracker } from '../src/services/live-tracker.js';

describe('LiveTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for unknown ids', () => {
    const t = new LiveTracker();
    expect(t.isLive('00000000-0000-0000-0000-000000000001')).toBe(false);
  });

  it('returns true after beat() within TTL', () => {
    const t = new LiveTracker(60_000); // 60s
    t.beat('abc');
    expect(t.isLive('abc')).toBe(true);
  });

  it('returns true just before the TTL boundary', () => {
    const t = new LiveTracker(60_000);
    t.beat('abc');
    vi.advanceTimersByTime(59_999);
    expect(t.isLive('abc')).toBe(true);
  });

  it('returns false just after the TTL boundary', () => {
    const t = new LiveTracker(60_000);
    t.beat('abc');
    vi.advanceTimersByTime(60_000);
    expect(t.isLive('abc')).toBe(false);
  });

  it('defaults to 30-minute TTL', () => {
    const t = new LiveTracker();
    t.beat('abc');
    vi.advanceTimersByTime(30 * 60 * 1000 - 1);
    expect(t.isLive('abc')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(t.isLive('abc')).toBe(false);
  });

  it('beat() refreshes the timestamp', () => {
    const t = new LiveTracker(60_000);
    t.beat('abc');
    vi.advanceTimersByTime(50_000);
    t.beat('abc');
    vi.advanceTimersByTime(50_000);
    expect(t.isLive('abc')).toBe(true); // 50s since last beat, still within TTL
  });

  it('evictExpired() removes entries older than 2*TTL', () => {
    const t = new LiveTracker(60_000);
    t.beat('old');
    vi.advanceTimersByTime(121_000); // > 2 * 60s
    t.beat('fresh');
    t.evictExpired();
    expect(t.size).toBe(1);
    expect(t.isLive('old')).toBe(false);
    expect(t.isLive('fresh')).toBe(true);
  });

  it('evictExpired() keeps entries within 2*TTL even if not live', () => {
    const t = new LiveTracker(60_000);
    t.beat('borderline');
    vi.advanceTimersByTime(90_000); // past TTL but within 2*TTL
    t.evictExpired();
    expect(t.size).toBe(1);
    expect(t.isLive('borderline')).toBe(false);
  });

  it('size reflects the number of tracked ids', () => {
    const t = new LiveTracker();
    expect(t.size).toBe(0);
    t.beat('a');
    t.beat('b');
    expect(t.size).toBe(2);
    t.beat('a'); // overwrite, no growth
    expect(t.size).toBe(2);
  });
});
