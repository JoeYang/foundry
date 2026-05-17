import type { DbClient } from '@foundry/db';
import { findProjectByPath, insertNote, type NoteRow } from '@foundry/db';
import type { AddNoteInput } from '@foundry/shared';
import type { LiveTracker } from './live-tracker.js';
import { notFound } from '../errors.js';

export interface AgentNotesDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

export function makeAgentNotes(deps: AgentNotesDeps) {
  const { db, liveTracker } = deps;

  return {
    async add(input: AddNoteInput): Promise<NoteRow> {
      return db.db.transaction(async (tx) => {
        const project = await findProjectByPath(tx, input.path);
        if (!project) throw notFound(`no project at path ${input.path}`);
        const note = await insertNote(tx, {
          project_id: project.id,
          body: input.body,
          author: input.author,
        });
        liveTracker.beat(project.id);
        return note;
      });
    },
  };
}
