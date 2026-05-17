import type { DbClient } from '@foundry/db';
import {
  findProjectByPath,
  insertDecision,
  findDecisionById,
  markDecisionSuperseded,
  type DecisionRow,
} from '@foundry/db';
import type {
  AddDecisionInput,
  SupersedeDecisionInput,
} from '@foundry/shared';
import type { LiveTracker } from './live-tracker.js';
import { notFound, validation } from '../errors.js';

export interface AgentDecisionsDeps {
  db: DbClient;
  liveTracker: LiveTracker;
}

export function makeAgentDecisions(deps: AgentDecisionsDeps) {
  const { db, liveTracker } = deps;

  return {
    async add(input: AddDecisionInput): Promise<DecisionRow> {
      return db.db.transaction(async (tx) => {
        const project = await findProjectByPath(tx, input.path);
        if (!project) throw notFound(`no project at path ${input.path}`);
        const decision = await insertDecision(tx, {
          project_id: project.id,
          title: input.title,
          rationale: input.rationale,
          alternatives: input.alternatives ?? [],
          decision: input.decision ?? {},
          made_by: input.actor,
        });
        liveTracker.beat(project.id);
        return decision;
      });
    },

    async supersede(input: SupersedeDecisionInput): Promise<DecisionRow> {
      return db.db.transaction(async (tx) => {
        const project = await findProjectByPath(tx, input.path);
        if (!project) throw notFound(`no project at path ${input.path}`);
        const prior = await findDecisionById(tx, input.prior_id);
        if (!prior) throw notFound(`no decision with id ${input.prior_id}`);
        if (prior.project_id !== project.id) {
          throw validation('prior decision belongs to a different project');
        }
        if (prior.superseded_by !== null) {
          throw validation('prior decision is already superseded');
        }
        const newDecision = await insertDecision(tx, {
          project_id: project.id,
          title: input.title,
          rationale: input.rationale,
          alternatives: input.alternatives ?? [],
          decision: input.decision ?? {},
          made_by: input.actor,
        });
        await markDecisionSuperseded(tx, input.prior_id, newDecision.id);
        liveTracker.beat(project.id);
        return newDecision;
      });
    },
  };
}
