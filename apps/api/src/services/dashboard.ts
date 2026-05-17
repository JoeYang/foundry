import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { DbClient } from '@foundry/db';
import {
  schema,
  findProjectBySlug,
  listDecisionsByProject,
  listTodosByProject,
  listNotesByProject,
  listRecentEvents,
  type ProjectRow,
  type DecisionRow,
  type TodoRow,
  type NoteRow,
  type ProjectEventRow,
} from '@foundry/db';
import type { LiveTracker } from './live-tracker.js';
import { computeDecay } from './decay.js';
import { notFound } from '../errors.js';
import type { Decay, ProjectStatus } from '@foundry/shared';

export interface DashboardDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

export interface DerivedProjectRow extends ProjectRow {
  live: boolean;
  decay: Decay;
}

export interface ListOpts {
  status?: ProjectStatus;
  search?: string;
  sort?: 'recently_updated' | 'name_asc' | 'last_heartbeat_desc';
  includeArchived?: boolean;
}

type TimelineItem =
  | { kind: 'event'; occurred_at: string; data: ProjectEventRow }
  | { kind: 'decision'; occurred_at: string; data: DecisionRow }
  | { kind: 'todo'; occurred_at: string; data: TodoRow }
  | { kind: 'note'; occurred_at: string; data: NoteRow };

export function makeDashboard(deps: DashboardDeps) {
  const { db, liveTracker } = deps;

  return {
    async list(opts: ListOpts = {}): Promise<DerivedProjectRow[]> {
      const conds: SQL[] = [];
      if (!opts.includeArchived) conds.push(eq(schema.projects.archived, false));
      if (opts.status) conds.push(eq(schema.projects.status, opts.status));
      if (opts.search) {
        // ILIKE with trgm-friendly pattern; pg_trgm index handles fuzzy match
        const pattern = `%${opts.search}%`;
        conds.push(
          sql`(${schema.projects.name} ILIKE ${pattern} OR ${schema.projects.summary} ILIKE ${pattern} OR ${schema.projects.path} ILIKE ${pattern})`,
        );
      }
      const where = conds.length ? and(...conds) : undefined;

      // Default sort: pinned DESC, updated_at DESC
      const orderBy = (() => {
        if (opts.sort === 'name_asc') return [desc(schema.projects.pinned), schema.projects.name];
        if (opts.sort === 'last_heartbeat_desc')
          return [desc(schema.projects.pinned), desc(schema.projects.updated_at)];
        return [desc(schema.projects.pinned), desc(schema.projects.updated_at)];
      })();

      const rows = where
        ? await db.db.select().from(schema.projects).where(where).orderBy(...orderBy)
        : await db.db.select().from(schema.projects).orderBy(...orderBy);

      return rows.map((r) => ({
        ...r,
        live: liveTracker.isLive(r.id),
        decay: computeDecay(r.status, r.updated_at),
      }));
    },

    async getDetailBySlug(slug: string): Promise<DerivedProjectRow> {
      const project = await findProjectBySlug(db.db, slug);
      if (!project) throw notFound(`no project with slug ${slug}`);
      return {
        ...project,
        live: liveTracker.isLive(project.id),
        decay: computeDecay(project.status, project.updated_at),
      };
    },

    async timelineBySlug(slug: string): Promise<TimelineItem[]> {
      const project = await findProjectBySlug(db.db, slug);
      if (!project) throw notFound(`no project with slug ${slug}`);
      const [events, decisions, todos, notes] = await Promise.all([
        listRecentEvents(db.db, project.id, 100),
        listDecisionsByProject(db.db, project.id),
        listTodosByProject(db.db, project.id),
        listNotesByProject(db.db, project.id),
      ]);
      const items: TimelineItem[] = [
        ...events.map((e) => ({
          kind: 'event' as const,
          occurred_at: e.occurred_at.toISOString(),
          data: e,
        })),
        ...decisions.map((d) => ({
          kind: 'decision' as const,
          occurred_at: d.made_at.toISOString(),
          data: d,
        })),
        ...todos.map((t) => ({
          kind: 'todo' as const,
          occurred_at: t.added_at.toISOString(),
          data: t,
        })),
        ...notes.map((n) => ({
          kind: 'note' as const,
          occurred_at: n.created_at.toISOString(),
          data: n,
        })),
      ];
      items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return items;
    },

    async decisionsBySlug(slug: string): Promise<DecisionRow[]> {
      const project = await findProjectBySlug(db.db, slug);
      if (!project) throw notFound(`no project with slug ${slug}`);
      return listDecisionsByProject(db.db, project.id);
    },

    async todosBySlug(slug: string): Promise<TodoRow[]> {
      const project = await findProjectBySlug(db.db, slug);
      if (!project) throw notFound(`no project with slug ${slug}`);
      return listTodosByProject(db.db, project.id);
    },

    async notesBySlug(slug: string): Promise<NoteRow[]> {
      const project = await findProjectBySlug(db.db, slug);
      if (!project) throw notFound(`no project with slug ${slug}`);
      return listNotesByProject(db.db, project.id);
    },
  };
}
