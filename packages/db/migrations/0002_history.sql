-- Foundry migration 0002: history tables (append-only) + first-class aspects
-- project_events, project_decisions, project_todos, project_notes.
-- Role grants enforce append-only at the DB layer: foundry_app may INSERT
-- and SELECT on history tables but has NO UPDATE/DELETE.

CREATE TYPE project_event_kind AS ENUM (
  'created',
  'status_changed',
  'next_step_changed',
  'summary_changed',
  'goal_changed',
  'links_changed',
  'tech_stack_changed',
  'human_flag_changed'
);

CREATE TABLE project_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        project_event_kind NOT NULL,
  payload     jsonb NOT NULL,
  actor       text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_events_timeline ON project_events (project_id, occurred_at DESC);
CREATE INDEX project_events_kind     ON project_events (kind, occurred_at DESC);

CREATE TABLE project_decisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  rationale     text NOT NULL,
  alternatives  jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision      jsonb NOT NULL DEFAULT '{}'::jsonb,
  superseded_by uuid REFERENCES project_decisions(id),
  made_at       timestamptz NOT NULL DEFAULT now(),
  made_by       text NOT NULL
);
CREATE INDEX project_decisions_project_time ON project_decisions (project_id, made_at DESC);
CREATE INDEX project_decisions_current      ON project_decisions (project_id)
  WHERE superseded_by IS NULL;

CREATE TYPE todo_status AS ENUM ('open','in_progress','done','cancelled');
CREATE TABLE project_todos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text          text NOT NULL,
  status        todo_status NOT NULL DEFAULT 'open',
  added_at      timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  added_by      text NOT NULL
);
CREATE INDEX project_todos_open ON project_todos (project_id, added_at DESC)
  WHERE status IN ('open','in_progress');

CREATE TABLE project_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body       text NOT NULL,
  author     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_notes_project_time ON project_notes (project_id, created_at DESC);

-- Role grants: enforce append-only at the DB layer.
-- foundry_app: INSERT + SELECT on history tables, NO UPDATE/DELETE.
GRANT INSERT, SELECT ON project_events TO foundry_app;
GRANT INSERT, SELECT ON project_decisions TO foundry_app;
GRANT INSERT, SELECT ON project_notes TO foundry_app;

-- project_todos has mutable status — full DML allowed.
GRANT SELECT, INSERT, UPDATE, DELETE ON project_todos TO foundry_app;

GRANT USAGE ON TYPE project_event_kind TO foundry_app;
GRANT USAGE ON TYPE todo_status TO foundry_app;
