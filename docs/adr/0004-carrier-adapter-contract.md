# 0004. Carrier adapter contract

Status: **accepted**
Date: 2026-05-14

## Context

Five carriers, five APIs, five status enumerations, five webhook signature schemes. We need a seam that lets us add new carriers without touching anything above the seam, and that lets us swap a sandbox for production without changing call sites.

## Decision

A single `CarrierAdapter` interface in `packages/adapters/src/common/contract.ts`. Every carrier has its own module under `src/<carrier>/` and is registered with a `StaticAdapterRegistry`. Each adapter:

- Maps the carrier's status enum to our normalized `ShipmentStatus`.
- Verifies the carrier's webhook signature scheme before any state mutation.
- Translates carrier-specific errors to `UsvError` subclasses with stable `code` fields.
- Owns no per-request mutable state on the instance.

Every adapter must pass the shared contract test suite in `packages/adapters/test/contract.suite.ts`.

## Consequences

- New carriers cost about a week if their API is well-documented: status table, request/response mapping, contract suite passes, sandbox integration test.
- The reference implementation is GHN. New contributors copy that module and adapt.
- The seam is also where a PaaS layer plugs in: third parties can ship adapter packages and register them in their own deployments.

## Alternatives considered

- **One adapter class with carrier-specific subclasses**: rejected; inheritance encourages shared mutable state we don't want.
- **No interface, one function per (carrier, operation)**: rejected; we'd lose the ability to inject a single mock per carrier in tests, and the call sites would be peppered with switch statements.
