# Summary

<!-- One paragraph. What changes and why? -->

## Scope

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Docs
- [ ] CI/Infra
- [ ] Carrier adapter (`ghn` / `ghtk` / `jnt` / `viettelpost` / `ninjavan`)

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally
- [ ] Changeset added (`pnpm changeset`) for user-visible changes
- [ ] DB schema change includes a Prisma migration + shadow-DB-tested
- [ ] Adapter change passes `pnpm test:contract`
- [ ] No secrets in diff
- [ ] Updated runbook or ADR if behavior or invariants changed

## Risk & rollout

<!-- Blast radius? Feature flagged? Rollback procedure? -->
