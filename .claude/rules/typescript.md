---
paths: ["apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts"]
---
# TypeScript Rules

- `strict: true` in every `tsconfig.json` — no exceptions, no `// @ts-ignore` without a comment explaining why
- Prefer `unknown` over `any`; if you reach for `any`, stop and model the type properly
- Type all module boundaries: function args, return types, exported symbols
- Validate runtime data with `zod` schemas at every system boundary (HTTP, env vars, anything bypassing the ORM)
- Share types via `packages/shared` — never duplicate types between web, api, and mcp
- Use `import type` for type-only imports
- Prefer discriminated unions over inheritance hierarchies
- No default exports — named exports keep refactors safe
- Errors are typed: throw subclasses of a base `AppError` (or use a `Result` type) — never throw raw strings or untyped objects
