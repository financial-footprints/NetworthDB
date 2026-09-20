# ADR-009: Transaction Rules Engine

## Status

Accepted

## Context

Users need to automate ledger classification and cleanup: match transactions by description, amount, accounts, dates, taxonomy, and import batch, then apply actions such as setting categories, retagging, reclassifying system accounts, or deleting noise rows. Statement ingest creates many rows with Unknown as the default counterpart; rules should run without vault unlock so unattended pipelines can classify immediately after insert.

Mail and statement rules on the account aggregate remain for pipeline file matching. Transaction rules are a separate concern: they operate on SQL ledger facts.

## Decision

### Placement

- Transaction rules live in the **Account** bounded context as an owner submodule (same pattern as taxonomy and the SQL ledger). They are not a separate npm package or top-level bounded context.

### Catalog Model

- **Rule groups** are user-scoped, ordered, and may be deactivated. **Rules** belong to one group and carry a `when` expression (`and` / `or` groups of typed trigger leaves), `stop_processing`, and `run_on_create`.
- Trigger leaves and actions are discriminated objects (`type` plus typed payloads). The catalog covers mutable ledger fields: description, reference, amount, date, source/destination accounts, pair kind, category, tags, and import linkage. There is no generic Firefly-style `value` / `value2` bag and no `set_amount` action.
- Matching uses loaded account entities for pair and account-type predicates, not ids alone.

### Execution (Later Phases)

- **On create:** after rows persist (manual create, batch, or statement ingest), walk active groups and rules where `run_on_create` is true.
- **Manual apply:** user-selected rule or group over optional filters via a background job.
- The rule engine mutates facts through the transaction repository and must not re-enter `TransactionService` (AAL2 and summary rebuild stay in the transaction layer).

### Encryption

- Rule group and rule **titles**, **descriptions**, and JSONB **triggers** and **actions** are ADR-004 **tier 3 plaintext** so the server can evaluate rules after ingest without vault unlock.

### Lifecycle

- No default seed rules. Rules do not run automatically on transaction update (PATCH); only on create and via manual apply.

## Alternatives Considered

| Alternative | Why rejected |
| ----------- | ------------ |
| New `@ndb/rules` package | Matcher is domain logic tied to Account entities; no separate compute or I/O |
| Per-account rule catalogs | Transfers involve two accounts; user scope with account triggers is simpler |
| E2E rule JSON | Blocks unattended ingest classification |
| Firefly generic trigger payloads | Harder to validate and document; explicit unions per field |

## Consequences

### Positive

- Ingest and manual rows share one matcher and action catalog.
- Rules are testable in `@ndb/core` without HTTP or Postgres.

### Negative

- Rule text and merchant patterns in JSON are readable to a DB operator (tier 3 trade-off).
- Large trigger/action catalog requires thorough unit tests.

### Neutral

- HTTP CRUD and persistence arrive in a follow-on phase; domain matcher ships first.

## References

- [ADR-001](001-domain-driven-design.md) — Account bounded context
- [ADR-004](004-data-encryption-policy.md) — tier classification
- [ADR-006](006-transactions-ledger.md) — ledger facts and ingest
- [ADR-007](007-transaction-taxonomy.md) — categories and tags
