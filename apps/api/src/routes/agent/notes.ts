import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { addNoteInputSchema } from '@foundry/shared';
import { makeAgentNotes } from '../../services/agent-notes.js';

export const notesRoute: FastifyPluginAsyncZod = async function notesRoute(app) {
  app.post('/notes', {
    schema: { body: addNoteInputSchema },
  }, async (req) => {
    const svc = makeAgentNotes({ db: app.deps.db, liveTracker: app.deps.liveTracker });
    return svc.add(req.body);
  });
}
