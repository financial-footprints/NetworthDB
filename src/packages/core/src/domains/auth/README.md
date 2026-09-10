# Auth domain

Authentication bounded context: sessions, multifactor, recovery, and WebAuthn ceremonies.

[`AuthService`](services/auth-service.ts) owns the public surface. HTTP and middleware talk to `AuthService` (and nested `auth.multifactor`, `auth.webauthn`, `auth.recovery`). Module classes stay as collaborators; they are not peer entry points.

## Root layout

| Path                                                                               | Contents                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`constants.ts`](constants.ts)                                                     | `APP_ENVS`, ACR/AMR constants                        |
| [`helpers.ts`](helpers.ts)                                                         | Types, `AuthContext` builders, `assertAal2`          |
| [`entities/session.ts`](entities/session.ts)                                       | `Session`                                            |
| [`repositories/session-repository.ts`](repositories/session-repository.ts)         | Session port + `SessionFilters`                      |
| [`services/auth-service.ts`](services/auth-service.ts)                             | Owner: login, refresh, logout, me, session lifecycle |
| [`services/session-lifecycle.ts`](services/session-lifecycle.ts)                   | Issue, rotate, revoke sessions                       |
| [`embedded/`](embedded/)                                                           | Shared crypto: password, tokens, secret encryption   |

## Feature modules (`modules/`)

| Module                                             | Role                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| [`modules/multifactor/`](modules/multifactor/)     | Challenges, TOTP, recovery codes; nested as `auth.multifactor`    |
| [`modules/recovery/`](modules/recovery/)           | Email/token flows; nested as `auth.recovery`                      |
| [`modules/webauthn/`](modules/webauthn/)           | Credentials and ceremonies; nested as `auth.webauthn`             |

## Vault

Vault slots live under [`user/modules/vault/`](../user/modules/vault/README.md) (user-owned). `VaultService` is injected into AuthService for recovery and WebAuthn PRF; HTTP uses `services.vault`.

## Dependencies

Auth reads `User` and `PublicUser` from the user domain. User services call `AuthService.revoke` after admin user changes.
