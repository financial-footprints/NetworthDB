# @ndb/encryption

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
| `decodeKey` | Decode `FILESTORE_SECRET` / `MFA_SECRET` (hex or base64url) to 32 bytes |
| `encrypt` / `decrypt` | NWENC1 byte blobs |
| `encryptString` / `decryptString` | UTF-8 string convenience (MFA TOTP) |
| `isEncrypted` | Detect NWENC1 magic header |

## Consumers

| Package | Usage |
| ------- | ----- |
| `@ndb/database` | Per-user data key wrap + tier-2 Postgres blobs |
| `@ndb/core` | MFA TOTP secrets (`MFA_SECRET`) |
| `@ndb/statements` | On-disk `.nwenc` vault files (Rust `rlib`, no NAPI) |

Build: `bun run --filter @ndb/encryption build:debug`
