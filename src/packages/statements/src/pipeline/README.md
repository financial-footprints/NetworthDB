# Pipeline

Statement sync orchestration — job entry points and stage logic.

## Layout

| Path | Role |
| ---- | ---- |
| `jobs/` | Job dispatch (`process.ts`), stage runner, serde, cancellation, alerts |
| `stages/extract/` | IMAP + Thunderbird → ephemeral staging |
| `stages/cleanup/` | Staging → vault writes, canonical paths |
| `stages/metadata/` | `metadata.json` build and coverage |
| `stages/parse/` | Transaction CSV writers |
| `stages/upload/` | Manual upload staging |
| `stages/delete/` | Account vault delete |

## Flow

```
sync:   extract → cleanup → parse → metadata
upload: cleanup → parse → metadata
delete: runDelete only
```

After a successful sync or upload job, core imports each unsynced vault `transactions-*.csv` into the ledger for that account.

## Dependencies

- `ingest/` — PDF, ZIP, email extraction
- `banks/` — handlers and parsers
- `storage/` — vault read/write
- `period/` — period keys
- `config/` — engine config
- `engine/errors` — stage errors and cancellation
