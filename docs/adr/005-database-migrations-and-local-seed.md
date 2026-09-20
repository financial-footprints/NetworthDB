# ADR-005: Database Migrations and Local Seed

## Status

Accepted

## Context

Schema changes must be versioned and applied consistently in local development and CI. The HTTP API must not own database bootstrap or fixture loading. Developers need repeatable local users and optional SQL fixtures without coupling seed logic to route handlers.

## Decision

### Migrations

- Drizzle schema lives under the database package; generated SQL under `drizzle/migrations/` is **read-only for automation** (developers run `make migrations name=<name>` after schema edits, then migrate).
- `@ndb/database` `migrate` applies Drizzle migrations, runs the readonly-role grant for `POSTGRES_RO_*`, then seed.
- The API runtime reads the database; it does not import migrate or seed scripts.

### Local seed

- When `ENVIRONMENT=local`, seed upserts fixed dev users (`admin`, `manasi`, `usher`; password `admin`) via TypeScript seed logic.
- Optional SQL under `drizzle/seed/` (`common.sql`; `local.template.sql` is a copy template for local-only SQL) extends fixtures.
- `SEED_RESET_USER_DATA=true` (tests / `.env.tests`) clears seed users' accounts, jobs, backup exports, sources, and vault rows before re-seeding.

### Copilot read-only access

- Migrate grants the `POSTGRES_RO_*` role; Copilot opens a read-only pool and tenant-scoped SQL executor. No separate schema or second migration path for MCP.

## Consequences

### Positive

- Clear boundary: schema evolution in migrations, dev fixtures in seed, domain logic in core.
- Copilot SQL uses the same Postgres instance with RLS and a dedicated readonly role.

### Negative

- Developers need Docker Postgres (and `psql` for some SQL seed workflows) on the machine.

### Neutral

- Production deploy migration strategy is outside this ADR (long-lived Bun API + Docker Postgres).

## Alternatives Considered

| Alternative | Why rejected |
| --- | --- |
| Seed from API startup | Couples runtime to fixtures; unsafe in production |
| Hand-edited migration SQL by agents | Error-prone; conflicts with Drizzle Kit workflow |

## References

- [DEV.md](../DEV.md)
- [ENVIRONMENT.md](../ENVIRONMENT.md)
- [ADR-001: Domain-Driven Design](./001-domain-driven-design.md)
