# 0001. Monorepo with pnpm + turborepo

Status: **accepted**
Date: 2026-05-14

## Context

We ship an API, a worker, a dashboard, a public SDK, and seven internal libraries that share the same domain types. Splitting them across separate repos would mean version-pinning between every commit and treating internal API churn as cross-repo work.

## Decision

One repo. `pnpm` workspaces for dependency management, `turborepo` for task orchestration and caching. The SDK is published from inside the monorepo via Changesets.

## Consequences

- One PR can land an API change, a schema migration, and a matching SDK release. CI catches version drift on the spot.
- `turbo`'s remote cache makes CI on warm runs fast even with seven packages.
- The dashboard cannot import the API's HTTP handlers directly; it goes through the SDK or the Prisma client like everything else. We enforce this via package-level exports and ESLint `no-restricted-imports`.
- Releases require discipline: the SDK is public, everything else is `private: true`. The Changesets config in `.changeset/config.json` enforces this by ignoring `@usv/api` / `@usv/worker` / `@usv/dashboard`.

## Alternatives considered

- **Polyrepo + Renovate**: rejected. Carrier-adapter changes routinely touch the API + worker + tests + docs; coordinating across repos would be friction we don't need.
- **Nx**: equivalent power. Turbo is simpler and we don't need Nx's plugin ecosystem.
