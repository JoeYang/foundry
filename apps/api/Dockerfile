# syntax=docker/dockerfile:1.7

# --- Stage 1: deps ---
# Install all workspace deps with the FULL monorepo lockfile so workspace
# protocol resolves correctly.
FROM node:22-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN npm ci

# --- Stage 2: runtime ---
FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

# Copy installed deps from the deps stage.
# npm workspaces hoists all deps to root node_modules — no per-workspace dirs.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json /repo/package-lock.json ./
COPY --from=deps /repo/apps/api/package.json apps/api/
COPY --from=deps /repo/apps/mcp/package.json apps/mcp/
COPY --from=deps /repo/packages/shared/package.json packages/shared/
COPY --from=deps /repo/packages/db/package.json packages/db/

# Copy source (workspaces needed at runtime by tsx)
COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/mcp/tsconfig.json apps/mcp/
COPY apps/mcp/src apps/mcp/src
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY packages/db/tsconfig.json packages/db/
COPY packages/db/src packages/db/src
COPY packages/db/migrations packages/db/migrations
COPY packages/db/drizzle.config.ts packages/db/

COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Non-root user
RUN groupadd -r foundry && useradd -r -g foundry -d /home/foundry -m foundry \
    && chown -R foundry:foundry /repo
USER foundry

EXPOSE 5380
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "--import", "tsx", "apps/api/src/boot.ts"]
