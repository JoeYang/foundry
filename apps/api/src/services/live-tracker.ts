const DEFAULT_TTL_MS = 30 * 60 * 1000;

export class LiveTracker {
  private heartbeats = new Map<string, number>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  beat(projectId: string): void {
    this.heartbeats.set(projectId, Date.now());
  }

  isLive(projectId: string): boolean {
    const last = this.heartbeats.get(projectId);
    if (last === undefined) return false;
    return Date.now() - last < this.ttlMs;
  }

  evictExpired(): void {
    const cutoff = Date.now() - this.ttlMs * 2;
    for (const [id, ts] of this.heartbeats) {
      if (ts < cutoff) this.heartbeats.delete(id);
    }
  }

  get size(): number {
    return this.heartbeats.size;
  }
}
