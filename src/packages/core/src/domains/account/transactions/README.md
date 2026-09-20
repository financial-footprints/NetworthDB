# Account Transactions

SQL ledger for an account: individual movements, import batches, and monthly summaries for fast range queries.

## Layout

| Path | Contents |
| ---- | -------- |
| `entities/transaction.ts` | `Transaction` aggregate (optional `categoryId`, `subcategoryId`, `tagIds`) |
| `entities/transaction-import.ts` | `TransactionImport` batch header |
| `entities/monthly-summary.ts` | `MonthlySummary` read model row |
| `repositories/transaction-repository.ts` | Persistence port |
| `services/transaction-service.ts` | CRUD, import batches, `ingestVaultCsv`, `balanceAsOf`, `summarizeRange` |
| `services/ledger-ingest-service.ts` | After upload/sync jobs, reads vault transaction CSVs and inserts SQL facts |

Statement files and sync flags live in the vault metadata, not on ledger tables (see ADR-006).
