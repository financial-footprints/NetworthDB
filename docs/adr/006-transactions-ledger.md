# ADR-006: Transactions Ledger

## Status

Accepted

## Context

Users need a queryable ledger across decades of data: list transactions in arbitrary date ranges, show balance as of a date, and search descriptions by whole words. Statement parse produces vault CSVs and, after a successful upload or sync job, the server inserts ledger rows from those CSVs. The ledger must not depend on statement file paths or periods in SQL.

## Decision

### Ledger Model

- **Source and destination** — Each row is one movement of a **positive** `amount` from `source_account_id` to `destination_account_id`. There is no `kind` column and no per-row credit/debit columns.
- **Four hidden system accounts per user** — `unknown` (Unknown), `revenue` (Revenue), `expense` (Expense), `tumbler` (Tumbler). Statement import uses **Unknown** as the default counterpart on both sides. Users reclassify to Revenue, Expense, or Tumbler in the ledger.
- **Instrument types** — User-created accounts are `bank`, `credit_card`, `loan`, `stocks`, `bonds`, and `mutual_funds`. Statement sync, upload, and calendar metadata apply only to `bank` and `credit_card`.
- **Three SQL tables** — `transactions` (fact rows), `transaction_imports` (batch headers for bulk replace), `transactions_monthly_summary` (per-account credits, debits, openings, closings per calendar month, derived from source/dest sums).
- **No statement columns on facts** — No source file, statement period, or sync flags on ledger tables. Vault `metadata.json` tracks `transactions_synced` and `transactions_import_id` per statement period.
- **Import batches** — Rows created in one bulk operation share `import_id`. Deleting the import row cascades to those transactions so re-import does not require guessing rows by date.
- **Taxonomy (optional)** — Facts may reference one category, one optional subcategory, and many tags (see ADR-007). Statement import leaves these unset; users classify in the ledger UI.

### Amounts and Dates

- Amounts stored as **bigint** integers (rupees × 100). Transaction rows store a single `amount`. Summary columns remain `amount_credit` / `amount_debit` / `amount_opening` / `amount_closing` relative to one account (destination = credit, source = debit).
- Calendar day in column **`date`** (tier 3 plaintext) for range queries and monthly rebuilds.

### Encryption

- **Description and reference** — Tier 3 plaintext (see ADR-004). Whole-word search uses case-insensitive token matching in SQL (`string_to_array(lower(description), ' ')` and the same for `ref_no`). The client sends the search token in plaintext.
- **Amounts, date, summaries** — Tier 3 plaintext so the server can sum and filter without vault unlock.

### Performance

- **Monthly summaries** — Balance as of a date uses the latest summary with `period_end <= on` plus a partial-month sum on facts. No Redis cache for ledger totals.
- **No per-row running balance** — Running balance on a UI page is computed from `balanceAsOf` plus rows on that page.

### Ingest

- After a successful upload or sync job, core reads each statement period’s vault `transactions` CSV, replaces the prior import batch when `transactions_import_id` is set, inserts SQL facts with plaintext description and reference, and sets `transactions_synced` / `transactions_import_id` on vault metadata via the statement engine. The browser does not import the ledger.
- Parser credited/debited columns map to source/destination once during server ingest (`LedgerIngestService` / `TransactionService.ingestVaultCsv`).
- **Transaction rules (on create):** after ingest inserts rows, active rules with `run_on_create` may classify, retag, reclassify system accounts, or delete rows. Ingest still leaves taxonomy unset until rules run. Wiring lives in a later phase; the domain matcher ships first.

## Alternatives Considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Random-nonce E2E per field | Cannot support server-side whole-word search without vault unlock on every list |
| Tie each row to `statement_period` in SQL | Couples ledger to statements; manual rows awkward |
| Firefly-style `balance_after` on every row | Heavy maintenance on backdated edits; we batch by import instead |
| Redis for range totals | Postgres monthly rows are already the cache |
| Credit/debit columns on transaction HTTP | Duplicates source/destination; pair type is the movement kind |

## Consequences

### Positive

- Fast range and as-of balance at large row counts.
- Re-import is one delete on `transaction_imports`.
- Search works without vault unlock.
- Transfers, income, and spend share one fact shape.

### Negative

- Merchant text in descriptions is readable to a DB operator (tier 3 trade-off for search, ingest, and backup).
- Monthly summary rebuild runs after every write batch for both source and destination accounts.

## References

- [ADR-001](001-domain-driven-design.md) — bounded contexts
- [ADR-003](003-end-to-end-encryption.md) — E2E wire format
- [ADR-004](004-data-encryption-policy.md) — tier classification
- [ADR-007](007-transaction-taxonomy.md) — categories and tags
- [ADR-009](009-transaction-rules-engine.md) — transaction rules on ingest
