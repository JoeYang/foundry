import type { DbClient } from '@foundry/db';
import {
  findProjectByPath,
  findTodoById,
  insertTodo,
  updateTodoStatus,
  type TodoRow,
} from '@foundry/db';
import type { AddTodoInput, UpdateTodoInput } from '@foundry/shared';
import type { LiveTracker } from './live-tracker.js';
import { notFound } from '../errors.js';

export interface AgentTodosDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

export function makeAgentTodos(deps: AgentTodosDeps) {
  const { db, liveTracker } = deps;

  return {
    async add(input: AddTodoInput): Promise<TodoRow> {
      return db.db.transaction(async (tx) => {
        const project = await findProjectByPath(tx, input.path);
        if (!project) throw notFound(`no project at path ${input.path}`);
        const todo = await insertTodo(tx, {
          project_id: project.id,
          text: input.text,
          added_by: input.actor,
        });
        liveTracker.beat(project.id);
        return todo;
      });
    },

    async update(todoId: string, input: UpdateTodoInput): Promise<TodoRow> {
      return db.db.transaction(async (tx) => {
        const existing = await findTodoById(tx, todoId);
        if (!existing) throw notFound(`no todo with id ${todoId}`);
        const completedAt = input.status === 'done' ? new Date() : existing.completed_at;
        const updated = await updateTodoStatus(tx, todoId, input.status, completedAt);
        liveTracker.beat(existing.project_id);
        return updated;
      });
    },
  };
}
