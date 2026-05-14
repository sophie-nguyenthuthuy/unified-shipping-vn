# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20.11.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages ./packages/skeleton
RUN find packages/skeleton -mindepth 2 -maxdepth 2 ! -name package.json -delete \
 && find packages/skeleton -mindepth 1 -maxdepth 1 -type d -exec sh -c 'mv "$1" "packages/$(basename $1)"' _ {} \; \
 || true
COPY packages ./packages
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN pnpm --filter @usv/db generate \
 && pnpm --filter @usv/core --filter @usv/observability --filter @usv/config \
        --filter @usv/db --filter @usv/adapters --filter @usv/webhooks \
        --filter @usv/reconciliation --filter @usv/sdk \
        --filter @usv/api build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN groupadd -r app && useradd -r -g app -d /app app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /repo /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/v1/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
