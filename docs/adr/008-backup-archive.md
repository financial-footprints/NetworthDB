# ADR-008: Backup Archive

## Status

Accepted

## Context

Users need a portable copy of accounts, statement sources, taxonomy, transaction rules, the ledger, and the E2E vault so they can delete an account, create a new one, and decrypt sealed fields again. Exports must run off the request path. Restore must merge the ledger without duplicating rows, while the destination vault is replaced by the archive wraps.

## Decision

### Jobs And One Ready File

- Backup **export** and **import** run as asynchronous jobs (`backup_export`, `backup_import`) with empty job scope on the existing in-process `JobRunnerService`.
- `POST /api/v1/backup/export` with a required ZIP password returns **202** and builds the archive in the background.
- Each user has **at most one ready ZIP**. Metadata lives in `backup_exports` (`expires_at` = created + 7 days). The file is `{FILESTORE_PATH}/{userId}/backups/{jobId}.zip`.
- `GET /api/v1/backup` returns the ready file (filename, size, expiry) and any active export `job_id`. `GET /api/v1/backup/file` downloads the current file as many times as needed until expiry.
- A new export keeps the previous ZIP until the new file is written and the metadata row is upserted; then the old file is deleted. A failed export does not replace the previous file.
- Expiry is enforced on read. An hourly API timer in all environments calls `purgeExpiredExports` then `purgeExpiredLogs`. No MinIO. No Kronos worker.

### ZIP Password

Every archive is AES-256 (zip.js) with a user-supplied password of at least 8 characters. The server never stores that password. This is independent of the vault DEK and of NWENC1.

### Archive Shape

One UTF-8 ZIP per export. Archive format identifier `"ndb.backup"` (no version suffix). Required entries:

- `manifest.json` with `"format": "ndb.backup"` and `created_at`.
- `vault.json` — opaque vault slots (`slot_type`, `salt`, `wrap_blob`, `label`, `credential_id`).
- `profile.json` — `display_name` as stored and `client_settings`.
- `accounts.json` (instrument accounts only).
- `system-accounts.json` (Unknown, Revenue, Expense, Tumbler counterparts).
- `transactions.jsonl` (one unique fact per line).

Optional entries (empty when absent): `sources.json`, `categories.json`, `tags.json`, `rule-groups.json`, `rules.json`, `imports.jsonl`.

Tier 1 fields stay ciphertext. Tier 2 secrets are plaintext inside the ZIP when sensitive backups are enabled. Tier 3 ledger text is plaintext.

### Restore

1. Replace destination vault slots with usable backup slots **before** ledger merge. Password and recovery-phrase slots always import. WebAuthn PRF slots import only when the destination already has that credential. If no usable slot remains, the job fails and dest vault is unchanged. An empty `slots` array skips vault replace.
2. Overwrite `display_name` and `client_settings`.
3. **System accounts:** map backup ids to the destination user’s system rows by `account_type`; never create a new system account from the ZIP.
4. **Instrument accounts:** upsert by id, account number, or bank metadata; backup UUIDs are mapped to destination ids. Account numbers stay as stored (ciphertext overwrite).
5. **Taxonomy:** match or create categories and tags; remap ids on transactions.
6. **Rules:** upsert rule groups and rules by id; rewrite UUID fields inside triggers and actions.
7. **Transactions:** skip rows whose id already belongs to this user; mint a new id only when another user owns that UUID globally.
8. Monthly summaries are rebuilt after import. The browser clears the session DEK so unlock uses the restored wraps.

### Exclusions

- Statement PDFs, CSVs, and other pipeline artifacts are not included.
- WebAuthn **credentials** are not copied. Passkeys from a deleted account will not unlock a new account.

## Alternatives Considered

| Alternative                         | Why Rejected                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| MinIO with lifecycle TTL            | One ZIP per user already lives on `FILESTORE_PATH`; lifecycle would duplicate Postgres metadata |
| Kronos-style scheduled worker       | Export/import are user-triggered jobs; expiry is a small timer next to existing log purge      |
| Client-side ZIP assembly            | Does not scale; duplicates server merge logic                                                  |
| Optional ZIP password               | Archive contains vault wraps; password is required                                             |
| Multiple manifest format versions   | v0 ships one format; import rejects unknown `format` values                                      |

## Consequences

### Positive

- A new account can decrypt E2E fields after restore if the user still knows a portable slot secret.
- Large exports stream from the database; one ready download link lasts 7 days.

### Negative

- Export and import jobs can take a long time; the browser polls backup status and jobs instead of blocking the HTTP request on ZIP build or restore (upload still completes on `POST /backup/import` before 202).
- A new login password does not unwrap an imported password slot unless it is the same secret; unlock with the old password or recovery phrase, then rewrap.

## References

- [ADR-003](003-end-to-end-encryption.md) — vault wraps
- [ADR-004](004-data-encryption-policy.md) — tier classification
- [ADR-006](006-transactions-ledger.md) — ledger model
