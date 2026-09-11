# `@ndb/auth`

Crypto and infrastructure adapters for authentication. Application services (`AuthService`, `MultifactorService`, `VaultService`, …) live in `@ndb/core`; this package implements outbound ports.

## Layout

| Path | Contents |
| --- | --- |
| `src/password.ts` | Argon2 `PasswordHasher` + `seedHashPassword` for database seed |
| `src/totp.ts` | `otpauth` `TotpEngine` |
| `src/tokens.ts` | `node:crypto` `TokenDigest` |
| `src/secrets.ts` | `@ndb/encryption` `SecretBox` (MFA secret at-rest) |
| `src/webauthn.ts` | `@simplewebauthn/server` `WebAuthnRelyingParty` |
| `src/crypto.ts` | `createAuthCrypto()` — bundles all crypto ports |
| `src/ratelimit.ts` | Redis-backed `RateLimiter` + `PasswordLockout` |

`domains/`, `entities/`, `embedded/`, and `modules/` are reserved for `@ndb/core`.

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
