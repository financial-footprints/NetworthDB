# @ndb/statements

Statement compute for NetworthDB: pure TypeScript engine, vault file I/O, pipeline stages, and a worker pool for parallel sync jobs.

## Environment

| Variable / dependency | Role |
| --------------------- | ---- |
| `qpdf` on `PATH` | Required when the API or worker pool starts (`createPool` fails with `bootstrap.statements.required.not-found.qpdf` if missing). Used to strip issuer PDF encryption before vault writes. |
| `FILESTORE_PATH` | Durable tenant root (`{FILESTORE_PATH}/{userId}/.vault/…`). Required in production; default `/tmp/networthdb` in local. Parsed by `@ndb/bootstrap`, passed into `createPool()` / `wrap()`. |
| `ENVIRONMENT` | `local` → plaintext vault files; non-local → NWENC1 (`.nwenc` blobs). Bootstrap sets `encryptAtRest` from `@ndb/database` storage config. |
| `JOBS_MAX_WORKERS` | Sizes both `JobRunnerService` and the statements worker pool (via bootstrap). |

Ephemeral scratch space is fixed at `{tmpdir}/networthdb-ephemeral/` for IMAP/Thunderbird extract, ZIP explode, and manual PDF staging before cleanup.

### Full mailbox backfill

Incremental IMAP extract uses `last_fetch_date` in `{account_type}/{account_id}/metadata.json` together with the account opening date. To re-fetch historical e-statements after a fix or a failed sync, remove the `last_fetch_date` property from that file (or set it before the desired range), then run a statements sync for the account. `last_fetch_date` advances only when the extract stage matches at least one message or saves an attachment.

### Re-parse after parser or PDF extract fixes (keep existing vault PDFs)

1. Delete `transactions-*.csv` under the account’s FY folders in `.vault/`.
2. Delete `credit_card/{account_id}/metadata.json` (statements list is rebuilt on the next sync).
3. Optionally delete `*.txt` so cleanup re-extracts text from vault PDFs (`refreshVaultStatementTxtFromPdf`).
4. Run a statements sync for the account (no need to clear `last_fetch_date` if PDFs are already in the vault).

Example account id `bbabd79c-efb9-438b-919b-ff3e97a4dabd` under `{FILESTORE_PATH}/{userId}/.vault/`.

After BOB balance/parser fixes, confirm adjacent months chain (e.g. `2025-11` closing **-1158.30** matches `2025-12` opening) in `metadata.json` and that `transactions-2025-11.csv` has three rows with `AMAZON` / `BBPS-PAYMENT` descriptions (no duplicate BBPS). Restart the API so the worker loads the new `@ndb/statements` code before syncing.

## TypeScript Public API

| Export | Role |
| ------ | ---- |
| `createPool` / `Pool` | Worker pool running pipeline jobs in `worker_threads` |
| `wrap(pool, config)` | Combines pool (compute) + local engine (reads) into one `StatementEngine` |

Bootstrap calls `wrap(createPool(...), config)` at API startup and injects the engine into `StatementsServices`. Tests use `initTestStatementsEngine()` in `@tests/bootstrap/helpers/statements-compute` (pool-backed).

## Vault Layout

Relative paths (under `{FILESTORE_PATH}/{userId}/.vault/`) follow the NetworthCSV FY tree, keyed by account UUID:

| Artifact | Example relative path |
| -------- | --------------------- |
| Monthly PDF | `FY23-2024/credit_card/{account_id}/2024-01.pdf` |
| Monthly TXT | `FY23-2024/credit_card/{account_id}/2024-01.txt` |
| Transactions CSV | `FY23-2024/credit_card/{account_id}/transactions-2024-01.csv` |
| Monthly CSV upload | `FY24-2025/credit_card/{account_id}/2024-04.csv` |
| Annual PDF/CSV | `FY24-2025/credit_card/{account_id}/2025.pdf` |
| Metadata | `credit_card/{account_id}/metadata.json` |

## Source Layout

| Layer | Role |
| ----- | ---- |
| `config/` | Engine config, vault store factory |
| `engine/` | `StatementEngine` port adapter |
| `worker/` | Pool + `worker_threads` |
| `pipeline/` | Job orchestration + stages (extract → parse) |
| `banks/` | Handlers + parsers |
| `storage/` | Vault I/O and read API |
| `ingest/` | PDF, ZIP, email extraction |
| `period/` | Statement/billing period keys |

See [`src/README.md`](src/README.md) for the full architecture diagram.

## Tests

```bash
bun run --filter @ndb/statements test
```
