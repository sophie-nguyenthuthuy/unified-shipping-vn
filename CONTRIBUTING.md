# Contributing

Thanks for considering a contribution. This project is opinionated; here's what to expect.

## Development setup

Requires Node 20+, pnpm 9+, Docker.

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm dev
```

## Commit style

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `build:`). Scope is the package or app: `feat(adapters/ghn): handle COD-only orders`.

## Adding a carrier adapter

1. Read [packages/adapters/src/common/contract.ts](packages/adapters/src/common/contract.ts) — every adapter implements `CarrierAdapter`.
2. Copy the GHN reference implementation under `packages/adapters/src/<carrier>/`.
3. Map the carrier's status enum to our normalized `ShipmentStatus` in `status-mapping.ts`. Be explicit; do not collapse statuses you do not understand.
4. Implement the carrier's webhook signature scheme in `webhook.ts`.
5. Add contract tests under `packages/adapters/test/<carrier>.contract.test.ts` using `runContractSuite` — these must pass before merge.
6. Add an integration test that hits the carrier's sandbox (skipped unless `*_SANDBOX_CREDS` env is set).
7. Update the coverage matrix in [README.md](README.md).

## Pull requests

- `pnpm lint && pnpm typecheck && pnpm test` must pass locally.
- Add a changeset for any user-visible change: `pnpm changeset`.
- One reviewer required; carrier adapter changes require review from someone who has tested against that carrier's sandbox.
- Do not commit secrets. Pre-commit hook scans for common patterns.

## Testing tiers

- **Unit** — pure logic, no IO. `pnpm test:unit`.
- **Contract** — every adapter must satisfy the same behavioral suite. `pnpm test:contract`.
- **Integration** — spins up Postgres + Redis via testcontainers, exercises the API and worker end-to-end. `pnpm test:integration`.
- **Carrier sandbox** — manual; requires real sandbox credentials. See `docs/runbooks/carrier-sandbox.md`.

## Code style

ESLint + Prettier are enforced. Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Prefer composition over inheritance. Pure functions where possible; side-effecting code lives at the edges (handlers, jobs).
