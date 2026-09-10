# ADR-003: E2E Encryption

## Status

Accepted

## Context

Sensitive application data must remain confidential even if a host operator can read
NetworthDB and NetworthSync databases or configuration (including
`MFA_ENCRYPTION_KEY`). [ADR-002](002-authentication.md) covers authentication;
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

| Layer        | Stores                                                                       | Can decrypt E2E fields? |
| ------------ | ---------------------------------------------------------------------------- | ----------------------- |
| NetworthDOM  | Session DEK (tab), plaintext only in memory/UI                               | Yes, after unlock       |
| NetworthDB   | Opaque `e2ee_*` field blobs; `users_vault` rows; Argon2id recovery-email hash | No                      |
| NetworthSync | Opaque ciphertext for financial payloads                                     | No                      |

Login `username`, roles, MFA enrollment flags, and **TOTP secrets** (server AES with
`MFA_ENCRYPTION_KEY`) are **not** E2E. Recovery email is stored as a **hash** for
verification only.

### Storage

| Location              | E2E?                         | Format                                        |
| --------------------- | ---------------------------- | --------------------------------------------- |
| `users_vault` rows    | Yes — wrapped DEK per slot   | `salt` (base64url) + `wrap_blob` (`nonce.ct`) |
| `users.e2ee_name`     | Yes — sealed real name       | `nonce.ct` blob                               |

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

Sealed blobs encode nonce and ciphertext as:

```text
{nonce_base64url}.{ciphertext_base64url}
```

The separator `.` is outside the base64url alphabet. Pack/unpack is shared between
NetworthDOM and NetworthDB validation
(`src/packages/core/src/domains/user/modules/vault/embedded/vault-wrap.ts`).

### Key hierarchy

1. **DEK** — random 256-bit AES-GCM key, generated in the browser.
2. **KEK per slot** — derived from that slot's secret; wraps the DEK via AES-GCM.
3. **Fields** — AES-GCM sealed with the DEK; stored as `e2ee_name` and additional
   `e2ee_*` columns as needed.

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
| `GET /api/v1/users/me`                    | Returns `e2ee_vault_initialized`, `e2ee_slots[]`, `e2ee_name` |
| `PATCH /api/v1/users/me`                  | `username`, `e2ee_name` only (no vault wrap fields)           |
| `POST /api/v1/users/me/vault/initialize`  | First-time vault + slots                                      |
| `POST /api/v1/users/me/vault/slots`       | Add slot                                                      |
| `PUT /api/v1/users/me/vault/slots/{id}`   | Rotate slot wrap                                              |
| `DELETE /api/v1/users/me/vault/slots/{id}` | Remove slot (409 if last)                                   |

### Advanced recovery (auth + data)

| Endpoint                                              | Purpose                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/recovery/advanced/begin`           | Email token when recovery email matches and user has `recovery_phrase` or `webauthn_prf` slot |
| `POST /api/v1/auth/recovery/advanced/context`         | `e2ee_vault_initialized`, `e2ee_slots[]`, `vault_recovery_methods` for token                |
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
- Server stores and validates opaque blobs only — no DEK or plaintext secrets.

### Negative

- Lost all slot secrets means permanent data loss (true E2EE trade-off).
- Client must implement vault crypto correctly; server cannot recover plaintext.

### Neutral

- Vault domain logic lives in `@ndb/core`; HTTP routes in `src/apps/api`.

### NetworthDOM

- Multi-slot vault helpers in `src/utils/crypto/vault.ts`; BIP39 phrase generation
  client-only; slot APIs for initialize/CRUD.

### NetworthDB

- `users_vault` table; slot validation in
  `src/packages/core/src/domains/user/modules/vault/embedded/vault-wrap.ts`;
  `VaultService` in
  `src/packages/core/src/domains/user/modules/vault/services/vault-service.ts`;
  vault routes in `src/apps/api/src/routes/users/vault.ts`.

## References

- [ADR-002](002-authentication.md) — authentication and recovery
- [ADR-001](001-domain-driven-design.md) — domain and package layout
- [`src/packages/platform/src/endpoints.ts`](../../src/packages/platform/src/endpoints.ts) — API path constants
- NetworthDOM `src/utils/crypto/` — client vault implementation
