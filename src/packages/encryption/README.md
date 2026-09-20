# `@ndb/encryption`

Single implementation of server-side symmetric encryption for NetworthDB.

## Format

All tier-2 blobs and MFA TOTP secrets at rest use **NWENC1**:

```text
NWENC1\n<base64url(nonce)>.<base64url(ciphertext ‖ auth_tag)>
```

Algorithm: AES-256-GCM with a 32-byte key and 12-byte nonce.

## API

| Export | Purpose |
| ------ | ------- |
| `encrypt` / `decrypt` | NWENC1 byte blobs (callers pass a valid 32-byte `Buffer` key) |
| `isEncrypted` | Detect NWENC1 magic header |
| `decodeSecretKey` | Decode `FILESTORE_SECRET` and `MFA_SECRET` env values (hex or base64url, 32 bytes) |

## Consumers

| Package | Usage |
| ------- | ----- |
| `@ndb/database` | Per-user data key wrap + tier-2 Postgres blobs |
| `@ndb/auth` | MFA TOTP secrets (`MFA_SECRET`) |
| `@ndb/statements` | On-disk `.nwenc` vault files |

Pure TypeScript — no build step. Run tests with `bun run --filter @ndb/encryption test`.
