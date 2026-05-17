-- Runs once on first container boot (before any migration).
-- Creates the restricted runtime role; migration 0002 grants table-level access.
CREATE ROLE foundry_app WITH LOGIN PASSWORD 'foundry_app';
GRANT CONNECT ON DATABASE foundry TO foundry_app;
GRANT USAGE ON SCHEMA public TO foundry_app;
