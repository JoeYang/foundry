import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { addTodoInputSchema, updateTodoInputSchema } from '@foundry/shared';
import { makeAgentTodos } from '../../services/agent-todos.js';

const todoIdParams = z.object({ id: z.string().uuid() });

export const todosRoutes: FastifyPluginAsyncZod = async function todosRoutes(app) {
  app.post('/todos', {
    schema: { body: addTodoInputSchema },
  }, async (req) => {
    const svc = makeAgentTodos({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.add(req.body);
  });

  app.patch('/todos/:id', {
    schema: { body: updateTodoInputSchema, params: todoIdParams },
  }, async (req) => {
    const svc = makeAgentTodos({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.update(req.params.id, req.body);
  });
}
