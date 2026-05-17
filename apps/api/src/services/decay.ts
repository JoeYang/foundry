import type { ProjectStatus, Decay } from '@foundry/shared';

const DAY_MS = 86_400_000;
const STALE_DAYS = 90;
const FOSSIL_DAYS = 365;

export function computeDecay(status: ProjectStatus, updatedAt: Date): Decay {
  const ageMs = Date.now() - updatedAt.getTime();
  const ageDays = ageMs / DAY_MS;
  if (ageDays >= FOSSIL_DAYS) return 'fossil';
  if (status === 'done' && ageDays >= STALE_DAYS) return 'stale';
  return 'fresh';
}
