# @ndb/statements

Rust statement pipeline and vault file I/O, exposed to TypeScript via NAPI and a domain adapter.

## Environment

| Variable | Role |
| -------- | ---- |
| `FILESTORE_PATH` | Durable tenant root (`{FILESTORE_PATH}/{userId}/.vault/…`). Required in production; default `/tmp/networthdb` in local. |
| `ENVIRONMENT` | `local` → plaintext vault files; non-local → NWENC1 (`.nwenc` blobs). |

Ephemeral scratch space is fixed at `{tmpdir}/networthdb-ephemeral/{userId}/{accountType}/{accountId}/` for IMAP/Thunderbird extract, ZIP explode, and manual PDF staging before cleanup.

Bootstrap calls `initStatementsRuntime()` at API startup, then `createStatementEngine()` wires
`StatementEngine` into `StatementsRuntime` for `AccountService`. Tests may override with
`initStatementsRuntime({ filestorePath, encryptAtRest })`.

## TypeScript public API

| Export | Role |
| ------ | ---- |
| `initStatementsRuntime` | Load `FILESTORE_PATH` / `ENVIRONMENT` (or test overrides) |
| `createStatementEngine` | Returns `StatementEngine` typed with `@ndb/core` entities |

`src/convert/` is the only place that maps `@ndb/core` entities to/from NAPI wire shapes.

## Vault layout

Relative paths (under `{FILESTORE_PATH}/{userId}/.vault/`) follow the NetworthCSV FY tree, keyed by
account UUID:

| Artifact | Example relative path |
| -------- | --------------------- |
| Monthly PDF | `FY23-2024/credit_card/{account_id}/2024-01.pdf` |
| Monthly TXT | `FY23-2024/credit_card/{account_id}/2024-01.txt` |
| Transactions CSV | `FY23-2024/credit_card/{account_id}/transactions-2024-01.csv` |
| Monthly CSV upload | `FY24-2025/credit_card/{account_id}/2024-04.csv` |
| Annual PDF/CSV | `FY24-2025/credit_card/{account_id}/2025.pdf` |
| Metadata | `credit_card/{account_id}/metadata.json` |

## Rust modules

| Module | Role |
| ------ | ---- |
| `domain/` | Internal compute types (idiomatic Rust; no NAPI) |
| `napi/` | NAPI wire types, FFI exports, wire → domain conversion |
| `vault/` | Runtime, store (NWENC1), path keys, ephemeral workspace |
| `banks/` | Handlers + parsers + registry for all institutions |
| `pipeline/` | Extract, cleanup, metadata, parse, upload, delete, alerts |

## Build

```bash
bun run --filter @ndb/statements build:debug
cargo test -p statements
```
