-- Foundry migration 0001: initial schema
-- Creates the projects table with constraints, indexes, and the updated_at trigger.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE project_status AS ENUM ('active','paused','blocked','done');

CREATE TABLE projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path              text NOT NULL UNIQUE,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  summary           text NOT NULL CHECK (length(summary) <= 280),
  goal              text NOT NULL DEFAULT '',
  status            project_status NOT NULL DEFAULT 'active',
  status_note       text,
  next_step         text,
  tech_stack        text[] NOT NULL DEFAULT '{}',
  links             jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_embedding  vector(1536),
  pinned            boolean NOT NULL DEFAULT false,
  archived          boolean NOT NULL DEFAULT false,
  needs_review      boolean NOT NULL DEFAULT false,
  user_notes        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_touch_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

CREATE INDEX projects_dashboard
  ON projects (archived, pinned DESC, updated_at DESC);
CREATE INDEX projects_status
  ON projects (status)
  WHERE archived = false;
CREATE INDEX projects_name_trgm
  ON projects USING gin (name gin_trgm_ops);

-- foundry_app gets full DML on projects (mutable current state).
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO foundry_app;
GRANT USAGE ON TYPE project_status TO foundry_app;
