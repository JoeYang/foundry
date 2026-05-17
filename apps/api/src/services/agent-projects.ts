import type { DbClient } from '@foundry/db';
import {
  findProjectByPath,
  insertProject,
  updateProjectById,
  slugExists,
  insertEvent,
  type ProjectRow,
} from '@foundry/db';
import type {
  UpsertProjectInput,
  SetStatusInput,
  SetNextStepInput,
  ProjectEventKind,
} from '@foundry/shared';
import { toSlug, ensureUniqueSlug } from './slug.js';
import type { LiveTracker } from './live-tracker.js';
import { notFound } from '../errors.js';

export interface AgentProjectsDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

const TRACKED_FIELDS = [
  'status',
  'next_step',
  'summary',
  'goal',
  'links',
  'tech_stack',
] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

const EVENT_KIND_BY_FIELD: Record<TrackedField, ProjectEventKind> = {
  status: 'status_changed',
  next_step: 'next_step_changed',
  summary: 'summary_changed',
  goal: 'goal_changed',
  links: 'links_changed',
  tech_stack: 'tech_stack_changed',
};

export function makeAgentProjects(deps: AgentProjectsDeps) {
  const { db, liveTracker } = deps;

  return {
    async upsert(input: UpsertProjectInput): Promise<ProjectRow> {
      return db.db.transaction(async (tx) => {
        const existing = await findProjectByPath(tx, input.path);

        if (!existing) {
          const baseSlug = toSlug(input.name);
          const slug = await ensureUniqueSlug(baseSlug, (s) => slugExists(tx, s));
          const project = await insertProject(tx, {
            path: input.path,
            slug,
            name: input.name,
            summary: input.summary,
            goal: input.goal ?? '',
            status: input.status ?? 'active',
            status_note: input.status_note ?? null,
            next_step: input.next_step ?? null,
            tech_stack: input.tech_stack ?? [],
            links: input.links ?? {},
            metadata: input.metadata ?? {},
          });
          await insertEvent(tx, project.id, 'created', {}, input.actor);
          liveTracker.beat(project.id);
          return project;
        }

        const patch: Record<string, unknown> = {};
        const events: Array<{ kind: ProjectEventKind; payload: Record<string, unknown> }> = [];

        for (const field of TRACKED_FIELDS) {
          const incoming = (input as Record<string, unknown>)[field];
          if (incoming === undefined) continue;
          const current = (existing as Record<string, unknown>)[field];
          if (JSON.stringify(current) !== JSON.stringify(incoming)) {
            patch[field] = incoming;
            events.push({
              kind: EVENT_KIND_BY_FIELD[field],
              payload: { from: current, to: incoming },
            });
          }
        }

        if (input.name !== existing.name) patch.name = input.name;
        if (input.status_note !== undefined && input.status_note !== existing.status_note) {
          patch.status_note = input.status_note;
        }
        if (input.metadata !== undefined) {
          patch.metadata = { ...existing.metadata as Record<string, unknown>, ...input.metadata };
        }

        let updated = existing;
        if (Object.keys(patch).length > 0) {
          updated = await updateProjectById(tx, existing.id, patch);
        }
        for (const ev of events) {
          await insertEvent(tx, existing.id, ev.kind, ev.payload, input.actor);
        }
        liveTracker.beat(existing.id);
        return updated;
      });
    },

    async heartbeat(path: string): Promise<{ project_id: string }> {
      const existing = await findProjectByPath(db.db, path);
      if (!existing) throw notFound(`no project at path ${path}`);
      liveTracker.beat(existing.id);
      return { project_id: existing.id };
    },

    async setStatus(input: SetStatusInput): Promise<ProjectRow> {
      return db.db.transaction(async (tx) => {
        const existing = await findProjectByPath(tx, input.path);
        if (!existing) throw notFound(`no project at path ${input.path}`);
        if (existing.status === input.status && existing.status_note === (input.note ?? null)) {
          liveTracker.beat(existing.id);
          return existing;
        }
        const updated = await updateProjectById(tx, existing.id, {
          status: input.status,
          status_note: input.note ?? null,
        });
        await insertEvent(
          tx,
          existing.id,
          'status_changed',
          { from: existing.status, to: input.status, note: input.note ?? null },
          input.actor,
        );
        liveTracker.beat(existing.id);
        return updated;
      });
    },

    async setNextStep(input: SetNextStepInput): Promise<ProjectRow> {
      return db.db.transaction(async (tx) => {
        const existing = await findProjectByPath(tx, input.path);
        if (!existing) throw notFound(`no project at path ${input.path}`);
        if (existing.next_step === input.next_step) {
          liveTracker.beat(existing.id);
          return existing;
        }
        const updated = await updateProjectById(tx, existing.id, {
          next_step: input.next_step,
        });
        await insertEvent(
          tx,
          existing.id,
          'next_step_changed',
          { from: existing.next_step, to: input.next_step },
          input.actor,
        );
        liveTracker.beat(existing.id);
        return updated;
      });
    },
  };
}
