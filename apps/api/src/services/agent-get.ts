import type { DbClient } from '@foundry/db';
import {
  findProjectByPath,
  listRecentEvents,
  listDecisionsByProject,
  listOpenTodosByProject,
  listRecentNotesByProject,
  type ProjectRow,
  type ProjectEventRow,
  type DecisionRow,
  type TodoRow,
  type NoteRow,
} from '@foundry/db';
import type { LiveTracker } from './live-tracker.js';
import { notFound } from '../errors.js';

export interface AgentGetDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

export interface AgentGetResult {
  project: ProjectRow;
  recent_events: ProjectEventRow[];
  open_todos: TodoRow[];
  current_decisions: DecisionRow[];
  recent_notes: NoteRow[];
}

export function makeAgentGet(deps: AgentGetDeps) {
  const { db, liveTracker } = deps;
  return {
    async get(path: string): Promise<AgentGetResult> {
      const project = await findProjectByPath(db.db, path);
      if (!project) throw notFound(`no project at path ${path}`);
      const [recent_events, open_todos, current_decisions, recent_notes] = await Promise.all([
        listRecentEvents(db.db, project.id, 10),
        listOpenTodosByProject(db.db, project.id),
        listDecisionsByProject(db.db, project.id, { currentOnly: true }),
        listRecentNotesByProject(db.db, project.id, 5),
      ]);
      liveTracker.beat(project.id);
      return { project, recent_events, open_todos, current_decisions, recent_notes };
    },
  };
}
