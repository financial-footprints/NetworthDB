# Storage

Vault I/O boundary — encrypted file store, path keys, and read-side metadata.

## Layout

| Path | Role |
| ---- | ---- |
| `vault/` | NWENC1 store, FY path keys, workspace scratch dirs |
| `read/` | Metadata list, statement file existence, transaction reads |

## Dependencies

- `config/` — `openVaultStore()`, `StatementsEngineConfig`
- `@ndb/encryption` — NWENC1 encrypt/decrypt (via `VaultStore`)
