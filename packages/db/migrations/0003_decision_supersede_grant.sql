-- Foundry migration 0003: allow foundry_app to set project_decisions.superseded_by
-- This is the only column-level UPDATE permitted on history tables; it is the
-- forward-link mechanism for the supersede chain. The prior decision's other
-- columns (title, rationale, alternatives, decision, made_at, made_by) remain
-- immutable — Postgres column-level grants enforce this at the DB layer.
-- Verified: UPDATE project_decisions SET title='x' still returns permission denied.
GRANT UPDATE (superseded_by) ON project_decisions TO foundry_app;
