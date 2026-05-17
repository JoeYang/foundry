---
paths: ["apps/api/src/routes/**", "apps/api/src/handlers/**", "packages/shared/src/schemas/**"]
---
# API Design Rules

## REST Conventions

- Resource-oriented paths: `GET /v1/projects/:id`, `POST /v1/projects`, `PATCH /v1/projects/:id`, `DELETE /v1/projects/:id`
- Version all paths under `/v1` — never expose unversioned endpoints
- Consistent error response shape:
  ```json
  {"error": "VALIDATION_FAILED", "message": "name is required", "request_id": "..."}
  ```
- Include `X-Request-ID` on every response for tracing
- Validate request body, params, and query with a zod schema from `packages/shared` — no manual `if (!body.foo)` checks
- Document every endpoint with an OpenAPI spec generated from the zod schemas (`@fastify/swagger` + a zod-to-openapi adapter)
- Idempotency: `PUT` and `DELETE` are idempotent. Provide idempotency keys for `POST /v1/projects` so MCP retries don't create duplicates
- Pagination: cursor-based for collections (`?cursor=…&limit=…`), never offset for the projects list

## MCP tool surface (future apps/mcp)

- Every tool name maps 1:1 to a REST endpoint; the MCP server is a thin adapter, not a second source of truth
- Tool input schemas come from the same `packages/shared` zod definitions used by the REST routes
- Tools return structured JSON; never return free-form prose that the model has to re-parse
- MCP tools enforce the same auth checks as the underlying REST endpoint

## General

- Never leak stack traces, internal IDs, or DB error messages in responses
- Auth checks on every protected route — both identity and permission
- Rate limit at the route group level; document upstream limits when calling external services
