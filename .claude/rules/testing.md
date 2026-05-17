---
paths: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"]
---
# Testing Rules

TDD workflow: write a failing test → implement → pass → refactor → re-run. Bug fixes start with a regression test that reproduces the bug.

Use vitest for all unit and integration tests. React components use React Testing Library on top of vitest. Run `npm test` from the repo root; it walks every workspace.

**Coverage target: all paths.** Every logical branch — happy path, every error branch, every edge case — has a test. Run `npm test -- --coverage` and treat uncovered lines as work that's not done.

## Failure injection (required)

Every feature ships with tests for:
- **Network:** fetch timeouts, HTTP 4xx/5xx, malformed JSON, dropped connections
- **Database:** connection refused, statement timeout, unique-constraint violation, transaction rollback, deadlock
- **Inputs:** empty payloads, missing required fields, oversize payloads, Unicode edge cases, SQL/HTML injection attempts
- **Auth (when present):** expired/missing tokens, insufficient permission, replayed requests
- **Concurrency:** simultaneous writes to the same row, race between read and write
- **Resource exhaustion:** connection pool saturation, large vector queries, slow embedding calls

## Practices

- Use `msw` to mock HTTP — never hit real upstream services in tests
- Use a real Postgres in integration tests (the docker compose Postgres or testcontainers), never an in-memory mock
- Each test cleans up its own data; never depend on test ordering
- Prefer `screen.getByRole` / `getByLabelText` over `getByTestId` — test what the user sees
- Never disable or skip a test to make CI green — fix the underlying issue
- Failure-path tests must assert: meaningful error message, clean state recovery, no data corruption
