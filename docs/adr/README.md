# Architecture Decision Records

Significant technical decisions for NetworthDB. Each ADR records **why** a choice was made — not how it is implemented today.

## Adding an ADR

1. Copy [000-template.md](./000-template.md) to the next number (e.g. `013-my-decision.md`).
2. Fill in context, decision, and consequences.
3. Mark any superseded ADRs in their status section.

## Index

| ADR | Title |
| --- | ----- |
| [001](./001-domain-driven-design.md) | Domain-Driven Design and Clean Architecture |
| [002](./002-authentication.md) | Authentication |
| [003](./003-end-to-end-encryption.md) | End-to-end encryption |
| [004](./004-data-encryption-policy.md) | Data encryption policy |
| [005](./005-database-migrations-and-local-seed.md) | Database migrations and local seed |
| [006](./006-transactions-ledger.md) | Transactions ledger |
| [007](./007-transaction-taxonomy.md) | Transaction taxonomy (categories and tags) |
| [008](./008-backup-archive.md) | Backup archive (server jobs and merge restore) |
| [009](./009-transaction-rules-engine.md) | Transaction rules engine |
| [010](./010-mcp-copilot.md) | MCP Copilot Host |
| [011](./011-active-period.md) | Active period preference |
| [012](./012-dashboard-insights.md) | Dashboard insights |
| [013](./013-card-benefit-catalogs.md) | Card benefit catalogs as files, shared via the HTTP API |
