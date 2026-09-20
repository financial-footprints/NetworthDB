# Auth Domain

Authentication bounded context: sessions, MFA, recovery, and WebAuthn.

## Layout

| Path | Contents |
| --- | --- |
| [`constants.ts`](constants.ts) | AAL/AMR constants, `AppEnv`, recovery kinds |
| [`entities/`](entities/) | `Session`, `MultifactorChallenge`, `RecoveryChallenge`, WebAuthn entities |
| [`embedded/`](embedded/) | Recovery codes, recovery tokens, recovery email helpers |
| [`helpers.ts`](helpers.ts) | `SessionTokenPair`, `AuthContext`, `assertAal2`, `PasswordLockout` |
| [`repositories/`](repositories/) | Persistence ports for sessions, MFA, recovery, WebAuthn |
| [`services/`](services/) | `AuthService`, `SessionLifecycle`, `MultifactorService`, `RecoveryService`, `WebAuthnService` |
| [`embedded/webauthn-ceremony.ts`](embedded/webauthn-ceremony.ts) | WebAuthn ceremony blob encode/decode |

Crypto adapters (`createAuthCrypto`, Argon2, TOTP, WebAuthn RP) live in [`@ndb/auth`](../../../../auth/README.md).

## Dependencies

- Other domains import `assertAal2` from [`helpers.ts`](helpers.ts) for MFA step-up.
- `UserService` accepts a narrow `SessionRevoker` hook (implemented by `AuthService`) after admin edits.
- `VaultService` lives under [`user/vault/`](../user/vault/README.md).
- Repository ports are implemented by `@ndb/database` Drizzle adapters.
- Services depend on `AuthCrypto` ports (`PasswordHasher`, `TotpEngine`, `SecretBox`, `TokenDigest`, `WebAuthnRelyingParty`) implemented by `@ndb/auth`.

## Import Rules

- Auth **types, entities, and services** — `@ndb/core`
- Auth **crypto adapters** (`createAuthCrypto`, `KvstoreAuthLimits`, `seedHashPassword`) — `@ndb/auth`
