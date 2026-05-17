import type { DbClient } from '@foundry/db';
import {
  findProjectBySlug,
  updateProjectById,
  deleteProjectBySlug,
  insertEvent,
  type ProjectRow,
} from '@foundry/db';
import type { PatchFlagsInput } from '@foundry/shared';
import { notFound } from '../errors.js';

export interface FlagsDeps {
  db: DbClient;
}

const FLAG_FIELDS = ['pinned', 'archived', 'needs_review', 'user_notes'] as const;
type FlagField = (typeof FLAG_FIELDS)[number];

const HUMAN_ACTOR = 'human:joeyang';

export function makeFlags(deps: FlagsDeps) {
  const { db } = deps;

  return {
    async patch(slug: string, input: PatchFlagsInput): Promise<ProjectRow> {
      return db.db.transaction(async (tx) => {
        const project = await findProjectBySlug(tx, slug);
        if (!project) throw notFound(`no project with slug ${slug}`);

        const patch: Record<string, unknown> = {};
        const changedFlags: Array<{ flag: FlagField; from: unknown; to: unknown }> = [];

        for (const flag of FLAG_FIELDS) {
          const incoming = (input as Record<string, unknown>)[flag];
          if (incoming === undefined) continue;
          const current = (project as Record<string, unknown>)[flag];
          if (current !== incoming) {
            patch[flag] = incoming;
            changedFlags.push({ flag, from: current, to: incoming });
          }
        }

        if (Object.keys(patch).length === 0) return project;

        const updated = await updateProjectById(tx, project.id, patch);

        // Emit ONE event per changed flag — distinct timeline entries
        for (const { flag, from, to } of changedFlags) {
          await insertEvent(
            tx,
            project.id,
            'human_flag_changed',
            { flag, from, to },
            HUMAN_ACTOR,
          );
        }

        return updated;
      });
    },

    async delete(slug: string): Promise<void> {
      const n = await deleteProjectBySlug(db.db, slug);
      if (n === 0) throw notFound(`no project with slug ${slug}`);
    },
  };
}
