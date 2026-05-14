# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20.11.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile=false \
 && pnpm --filter @usv/db generate \
 && pnpm --filter @usv/dashboard... build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
 && groupadd -r app && useradd -r -g app -d /app app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /repo /app
USER app
EXPOSE 3001
CMD ["pnpm", "--filter", "@usv/dashboard", "start"]
