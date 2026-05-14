# Security policy

## Reporting a vulnerability

Email **security@example.com** with a description, reproduction steps, and impact assessment. Please do not file public issues for security problems.

We aim to acknowledge within **2 business days** and provide an initial assessment within **7 days**. Critical issues get a coordinated disclosure timeline of up to 90 days.

## Supported versions

The `main` branch and the most recent minor release receive security updates.

## Threat model

See [docs/SECURITY.md](docs/SECURITY.md) for the full threat model, including:

- API key compromise & rotation
- Webhook replay and forgery
- Carrier credential storage (envelope encryption with KMS)
- Multi-tenant isolation
- Idempotency & double-spend prevention on COD reconciliation
