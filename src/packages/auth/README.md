# `@ndb/auth`

Crypto and infrastructure adapters for authentication. Application services (`AuthService`, `MultifactorService`, `VaultService`, …) live in `@ndb/core`; this package implements outbound ports.

## Layout

| Path | Contents |
| --- | --- |
| `src/crypto/password.ts` | Argon2 `PasswordHasher` + `seedHashPassword` for database seed |
| `src/crypto/totp.ts` | `otpauth` `TotpEngine` |
| `src/crypto/tokens.ts` | `node:crypto` `TokenDigest` |
| `src/crypto/secrets.ts` | `@ndb/encryption` `SecretBox` (MFA secret at-rest) |
| `src/crypto/webauthn.ts` | `@simplewebauthn/server` `WebAuthnRelyingParty` |
| `src/crypto/index.ts` | `createAuthCrypto()` — bundles all crypto ports |
| `src/ratelimit.ts` | Redis-backed `RateLimiter` + `PasswordLockout` |

`domains/`, `entities/`, `embedded/`, and capability folders (for example `account/transactions/`) are reserved for `@ndb/core`.

## Dependencies

- `@ndb/core` — port interfaces (`AuthCrypto`, `PasswordHasher`, …)
- `@node-rs/argon2`, `otpauth`, `@simplewebauthn/server` — crypto libraries
- `@ndb/encryption` — MFA secret encrypt/decrypt
- `redis`, `rate-limiter-flexible` — auth rate limits and lockout

## Public API

```typescript
import { createAuthCrypto, KvstoreAuthLimits, seedHashPassword } from "@ndb/auth";
```

Auth **behavior** (`AuthService`, `VaultService`, …) is imported from `@ndb/core`. Bootstrap wires adapters via `createAuthServices()` in `@ndb/bootstrap`.
