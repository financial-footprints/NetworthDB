# Domain Bounded Contexts

Organize domain code by bounded context under `src/domains/<name>/`:

- `entities/` — domain entities (rich classes with invariants)
- `repositories/` — repository ports (interfaces)
- `services/` — application services and use cases
- `embedded/<cluster>/` — JSONB shapes (`types.ts`) and pure logic (`rules.ts`); types + functions only, no classes
- `<capability>/` — sibling capability folders within a bounded context (for example `account/transactions/`)

Cross-cutting domain errors live in `src/shared/errors/`.

Infrastructure (Postgres, HTTP) stays out of this package.

**Naming:** Folder and module context carry meaning; prefer short method names inside a module (for example `account.statements.upload`, `repository.save`) over long prefixed names at inner layers. Package boundaries and Drizzle adapters stay explicit (`DrizzleAccountRepository`, `serializeAccount`).

**Tests:** Colocated `*.test.ts` next to the unit under test. Shared fakes and helpers: `@ndb/core/tests` (inside core, `@core/tests`).

## Capability Folders

Use **sibling folders** when concerns are peers within the same bounded context (for example `account/transactions/`, `user/vault/`).

Each capability folder follows the same roles (`entities/`, `repositories/`, `services/`, `embedded/`, `index.ts`).

`embedded/<cluster>/` holds types embedded in aggregates or persisted as JSONB snapshots:

| File | Role |
| ---- | ---- |
| `types.ts` | Shape definitions, `empty*()`, `clone*()` |
| `rules.ts` | Parse persisted JSON, normalize fields, predicates |
| `index.ts` | Barrel re-exports |

**Embedded** owns shape hygiene and JSON hydration (`parse*Json`, `normalize*`). **Entities** own aggregate lifecycle, `with*Update` + private `clone`, and cross-field validation. Use `empty*()` factory functions, not `EMPTY_*` constants.

HTTP projections (`hasPassword`, `hasToken`, etc.) belong in `apps/api` serializers, not in core entities.

## Active Domains

| Domain | Role |
| ------ | ---- |
| [`user/`](user/README.md) | Identity, roles, admin operations; owns vault slots |
| [`auth/`](auth/README.md) | Sessions, multifactor, recovery, WebAuthn services; crypto adapters in `@ndb/auth` |
| [`account/`](account/README.md) | Financial accounts, backup, statement files, SQL ledger, taxonomy (categories/tags), and transaction rules |
| [`sources/`](sources/README.md) | Statement extraction sources (Thunderbird, IMAP) for the pipeline |
| [`jobs/`](jobs/README.md) | Job queue: `Job` aggregate, `JobService`, in-process `JobRunnerService` |

Public API flows through each domain's `index.ts` → `packages/core/src/index.ts` (`@ndb/core`).
