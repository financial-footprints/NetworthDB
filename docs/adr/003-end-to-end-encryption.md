# ADR-003: E2E Encryption

## Status

Accepted

## Context

Sensitive application data must remain confidential even if a host operator can read
the NetworthDB Postgres database, on-disk storage, or configuration (including
`MFA_SECRET`). [ADR-002](002-authentication.md) covers authentication;
this ADR defines the client-side encryption boundary.

Constraints:

- **Security first** — server must never see plaintext of E2E fields or the data
  encryption key (DEK).
- **Usable unlock** — requiring the login password on every sealed-field edit is
  unnecessary for confidentiality and harms UX. Unlock once per tab session; reuse
  the DEK from `sessionStorage`.
- **Auth recovery ≠ data recovery** — resetting the login password does not unlock
  ciphertext sealed to prior wraps.
- **Multi-key recovery** — users may protect the same DEK with any combination of
  password, recovery phrase, or passkey (WebAuthn PRF) slots; at least one slot
  required.

## Decision

### Confidentiality boundary

| Layer        | Stores                                                                                      | Can decrypt E2E fields? |
| ------------ | ------------------------------------------------------------------------------------------- | ----------------------- |
| NetworthDOM  | Session DEK (tab), plaintext only in memory/UI                                              | Yes, after unlock       |
| NetworthDB   | Opaque tier-1 field blobs; `users_vault` rows; Argon2id recovery-email hash; tier-2 blobs | No (tier 1 only)        |

Login `username`, roles, MFA enrollment flags, and **TOTP secrets** (server AES with
`MFA_SECRET`) are **not** E2E. Recovery email is stored as a **hash** for
verification only.

### Storage

| Location              | E2E?                         | Format                                        |
| --------------------- | ---------------------------- | --------------------------------------------- |
| `users_vault` rows    | Yes — wrapped DEK per slot   | `salt` (base64url) + `wrap_blob` (`nonce.ct`) |
| `users.display_name`  | Yes — sealed real name       | Opaque text from client                       |
| `accounts.account_number` | Yes — sealed account number | Opaque text from client                  |

### Slot types (`users_vault`)

| `slot_type`       | Secret                 | Derivation                                                 | Max per user              |
| ----------------- | ---------------------- | ---------------------------------------------------------- | ------------------------- |
| `password`        | Login password         | Argon2id + per-slot salt                                   | 0 or 1                    |
| `recovery_phrase` | 12-word BIP39 mnemonic | Argon2id + unique salt per slot                            | 0..10                     |
| `webauthn_prf`    | WebAuthn PRF output    | HKDF-SHA256(prfOutput, prfSalt, info=`networth-vault-kek`) | 0..N (one per credential) |

Every slot type is optional; a vault exists when the user has **≥1 slot**. The
plaintext recovery phrase **never leaves the browser** — the server stores only
opaque wraps.

### Blob format

Vault slot `wrap_blob` values and optional client-side sealed fields may encode
nonce and ciphertext as:

```text
{nonce_base64url}.{ciphertext_base64url}
```

The separator `.` is outside the base64url alphabet. Pack/unpack for **vault slot
wraps** is validated on the server
(`VaultSlot.packWrap` / `VaultSlot.unpackWrap` in `vault-slot.ts`).

Tier-1 API fields (`display_name`, `account_number`) are stored as opaque text.
NetworthDB validates non-empty string and max length only — it does not parse blob
shape or know whether the client encrypted the value.

### Key hierarchy

1. **DEK** — random 256-bit AES-GCM key, generated in the browser.
2. **KEK per slot** — derived from that slot's secret; wraps the DEK via AES-GCM.
3. **Fields** — AES-GCM sealed with the DEK; stored as opaque text columns such as
   `display_name` and `account_number`.

### Auth vs vault separation

| Layer            | Purpose               | Mechanism                                    |
| ---------------- | --------------------- | -------------------------------------------- |
| Authentication   | Login, sessions, MFA  | Argon2id password, WebAuthn MFA, recovery email |
| Vault decryption | Access encrypted data | Any enabled vault slot                       |

Password reset restores **authentication only**. Data recovery requires a surviving
vault slot.

### Session unlock (normal edit path)

On **first successful password login**, the client creates the vault automatically
with one `password` slot (`POST /api/v1/users/me/vault/initialize`). The DEK never
leaves the browser; the server stores only opaque wraps.

1. On password login, DOM unwraps the DEK from the password slot (if present) and
   stores it in **sessionStorage**.
2. While unlocked, sealed fields use that DEK. Updates send **opaque blobs only**.
3. Password is required again to **create**, **rotate**, or **delete** vault slots
   (with per-slot proof rules).

### API

| Endpoint                                  | Purpose                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `GET /api/v1/users/me`                    | Returns `vault_initialized`, `vault_slots[]`, `display_name` |
| `PATCH /api/v1/users/me`                  | `username`, `display_name` only (no vault wrap fields)        |
| `POST /api/v1/users/me/vault/initialize`  | First-time vault + slots; optional `display_name`             |
| `POST /api/v1/users/me/vault/slots`       | Add slot                                                      |
| `PUT /api/v1/users/me/vault/slots/{id}`   | Rotate slot wrap                                              |
| `DELETE /api/v1/users/me/vault/slots/{id}` | Remove slot (409 if last)                                   |

Account APIs accept and return `account_number` as opaque text on create, list,
get, patch, and account-details responses. The server does not inspect encryption
state.

### Advanced recovery (auth + data)

| Endpoint                                              | Purpose                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/recovery/advanced/begin`           | Email token when recovery email matches and user has `recovery_phrase` or `webauthn_prf` slot |
| `POST /api/v1/auth/recovery/advanced/context`         | `vault_initialized`, `vault_slots[]`, `vault_recovery_methods` for token                      |
| `POST /api/v1/auth/recovery/advanced/webauthn/begin`  | WebAuthn assertion for vault PRF passkeys (before complete wipes credentials)                 |
| `POST /api/v1/auth/recovery/advanced/complete`      | New password, optional `password_slot` re-wrap, clears MFA                                    |

Slot mutations require proof appropriate to slot type (password in body, AAL2, or
surviving passkey slot). Plaintext phrase fields in API bodies are **rejected**.

Passkey MFA delete is blocked when the credential is the user's **only** vault slot;
otherwise the matching vault slot is auto-deleted.

### Hashed recovery email

Enroll stores `recovery_email_hash`; recovery begin verifies hash and mails the
address the user typed.

### Residuals

| Residual                     | Mitigation                      |
| ---------------------------- | ------------------------------- |
| XSS while vault unlocked     | Clear DEK on logout; CSP        |
| Stolen session mutates slots | Per-slot proof requirements     |
| Offline wrap guessing        | Argon2id / BIP39 entropy        |
| Lost all slot secrets        | Permanent data loss (true E2EE) |

## Consequences

### Positive

- Sensitive data remains confidential even with full database and config access.
- Multi-slot vault supports password, recovery phrase, and passkey unlock paths.
- Server stores opaque text for tier-1 fields and validates vault wrap shape only
  where required — no DEK or plaintext secrets.

### Negative

- Lost all slot secrets means permanent data loss (true E2EE trade-off).
- Client must implement vault crypto correctly; server cannot recover plaintext.

### Neutral

- Vault slot entities and validation live in `@ndb/core`; `VaultService` ceremonies in `@ndb/auth`; HTTP routes in `src/apps/api`.

### NetworthDOM

- Multi-slot vault helpers in `src/utils/crypto/vault.ts`; BIP39 phrase generation
  client-only; slot APIs for initialize/CRUD.

### NetworthDB

- `users.display_name`, `accounts.account_number` — opaque text columns;
  `users_vault` table for slot wraps; slot validation in
  `src/packages/core/src/domains/user/modules/vault/entities/vault-slot.ts`;
  `VaultService` in `@ndb/auth` (`src/vault.ts`);
  vault routes in `src/apps/api/src/routes/users/vault.ts`.

## References

- [ADR-002](002-authentication.md) — authentication and recovery
- [ADR-001](001-domain-driven-design.md) — domain and package layout
- [`src/packages/platform/src/endpoints.ts`](../../src/packages/platform/src/endpoints.ts) — API path constants
- NetworthDOM `src/utils/crypto/` — client vault implementation
