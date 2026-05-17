# Security Rules (Standard / OWASP)

- **Secrets:** never hardcode credentials, API keys, or tokens. Read from `process.env` validated by a zod schema at startup; fail fast if a required var is missing
- **Input validation:** every HTTP handler validates body, params, and query via zod from `packages/shared` before touching any other code
- **SQL injection:** use Drizzle's query builder; raw SQL only with parameterized `` sql`SELECT … WHERE id = ${id}` `` template literals — never string concatenation
- **XSS:** never use `dangerouslySetInnerHTML`; sanitize any user content rendered as HTML
- **CSRF:** state-changing endpoints require either a CSRF token or `SameSite=strict` session cookies plus origin verification
- **Auth:** every protected route checks identity (authn) AND permission (authz). No "we'll add auth later" placeholders that ship to prod
- **Sessions:** use `HttpOnly`, `Secure`, `SameSite=strict` cookies for sessions; never put tokens in `localStorage`
- **Logging:** never log passwords, tokens, PII, full request bodies, or `req.headers.authorization`. Redact at the logger config, not at each call site
- **Crypto:** use `node:crypto` and standard libraries only — never roll your own. Passwords use `argon2` or `bcrypt`
- **CORS:** allowlist specific origins; never `Access-Control-Allow-Origin: *` on authenticated endpoints
- **MCP surface (future):** when `apps/mcp` ships, every tool exposed to Claude validates caller intent and never accepts arbitrary SQL or shell from arguments. MCP tools are subject to the same auth and rate limits as REST endpoints
- **Dependencies:** flag any package with known CVEs (`npm audit`) and any package unmaintained for >12 months before adding it
