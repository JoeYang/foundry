import type { FastifyInstance } from 'fastify';
import { z, type ZodSchema } from 'zod';
import {
  upsertProjectInputSchema,
  setStatusInputSchema,
  setNextStepInputSchema,
  addDecisionInputSchema,
  supersedeDecisionInputSchema,
  addTodoInputSchema,
  addNoteInputSchema,
} from '@foundry/shared';
import {
  makeAgentProjects,
  makeAgentDecisions,
  makeAgentTodos,
  makeAgentNotes,
  makeAgentGet,
} from '@foundry/api';

const heartbeatInputSchema = z.object({ path: z.string().min(1) });
const getInputSchema = z.object({ path: z.string().min(1) });
const updateTodoToolInputSchema = z.object({
  todo_id: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']),
});

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: ZodSchema;
  handler: (input: unknown) => Promise<unknown>;
}

export function buildTools(app: FastifyInstance): ToolDef[] {
  const deps = () => ({ db: app.deps.db, liveTracker: app.deps.liveTracker });

  return [
    {
      name: 'upsert_project',
      description:
        'Register or update a project by filesystem path. Creates if path is new, updates tracked fields otherwise.',
      inputSchema: upsertProjectInputSchema,
      handler: async (input) =>
        makeAgentProjects(deps()).upsert(upsertProjectInputSchema.parse(input)),
    },
    {
      name: 'heartbeat',
      description: 'Refresh the live indicator for a project by path. Does not write to DB.',
      inputSchema: heartbeatInputSchema,
      handler: async (input) =>
        makeAgentProjects(deps()).heartbeat(heartbeatInputSchema.parse(input).path),
    },
    {
      name: 'set_status',
      description: 'Change the project status (active/paused/blocked/done) with optional note.',
      inputSchema: setStatusInputSchema,
      handler: async (input) =>
        makeAgentProjects(deps()).setStatus(setStatusInputSchema.parse(input)),
    },
    {
      name: 'set_next_step',
      description: "Update the project's 'next step' — the single most important next action.",
      inputSchema: setNextStepInputSchema,
      handler: async (input) =>
        makeAgentProjects(deps()).setNextStep(setNextStepInputSchema.parse(input)),
    },
    {
      name: 'add_decision',
      description: 'Record a new architectural or product decision for the project.',
      inputSchema: addDecisionInputSchema,
      handler: async (input) =>
        makeAgentDecisions(deps()).add(addDecisionInputSchema.parse(input)),
    },
    {
      name: 'supersede_decision',
      description: 'Record a decision that replaces a prior one; links the prior via superseded_by.',
      inputSchema: supersedeDecisionInputSchema,
      handler: async (input) =>
        makeAgentDecisions(deps()).supersede(supersedeDecisionInputSchema.parse(input)),
    },
    {
      name: 'add_todo',
      description: 'Add an open todo item to the project.',
      inputSchema: addTodoInputSchema,
      handler: async (input) => makeAgentTodos(deps()).add(addTodoInputSchema.parse(input)),
    },
    {
      name: 'update_todo',
      description:
        'Change the status of an existing todo (by id). Setting status=done stamps completed_at.',
      inputSchema: updateTodoToolInputSchema,
      handler: async (input) => {
        const parsed = updateTodoToolInputSchema.parse(input);
        return makeAgentTodos(deps()).update(parsed.todo_id, { status: parsed.status });
      },
    },
    {
      name: 'add_note',
      description: 'Append a markdown note to the project (author can be agent or human).',
      inputSchema: addNoteInputSchema,
      handler: async (input) => makeAgentNotes(deps()).add(addNoteInputSchema.parse(input)),
    },
    {
      name: 'get_project',
      description:
        'Get a project plus its recent events, open todos, current decisions, and recent notes — the "remind me where I am" call.',
      inputSchema: getInputSchema,
      handler: async (input) =>
        makeAgentGet(deps()).get(getInputSchema.parse(input).path),
    },
  ];
}
