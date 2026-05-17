import { z } from 'zod';

/**
 * Filesystem path used as project identity. Non-empty, no null bytes
 * (Postgres text columns reject \x00 with a hard error).
 */
export const pathSchema = z
  .string()
  .min(1, 'path required')
  .refine((s) => !s.includes('\x00'), 'path must not contain null bytes');
