# User domain

Identity and account administration bounded context.

## Layout

| Path                                                                 | Contents                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `[entities/user/](entities/user/)`                                   | `User` aggregate with co-located `Username` and `TotpState` |
| `[entities/public-user.ts](entities/public-user.ts)`                 | Safe projection for API responses                                              |
| `[helpers.ts](helpers.ts)`                                           | Roles, access guards, list query/result types                                  |
| `[repositories/user-repository.ts](repositories/user-repository.ts)` | User persistence port + `UserFilters`                                          |
| `[services/user-service.ts](services/user-service.ts)`               | Register, list, patch, change password                                         |

## Feature modules (`modules/`)

| Module                                      | Role                                     |
| ------------------------------------------- | ---------------------------------------- |
| `[modules/vault/](modules/vault/README.md)` | Vault slots, wrap crypto, `VaultService` |

## Dependencies

- `user-service` imports auth for password hashing, AAL2 checks, and `revoke` after admin edits.
- `modules/vault/` imports `auth/modules/webauthn/` for PRF credential validation.
