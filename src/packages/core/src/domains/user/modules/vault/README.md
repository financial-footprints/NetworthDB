# User vault module

User-owned vault slots. Persisted in `users_vault` (see `packages/database/src/schema/users/vault.ts`).

## Layout

| Path | Contents |
| --- | --- |
| `constants.ts` | Slot types, size limits, `isVaultSlotType` |
| `entities/vault-slot.ts` | `VaultSlot` aggregate; field validation, wrap wire format, credential id encode/decode |
| `repositories/vault-slot-repository.ts` | Vault slot persistence port |
| `services/vault-service.ts` | `VaultService` (initialize, add, rotate, delete slots) |
| `types.ts` | `VaultSlotInput`, `VaultPublicState`, etc. |

## Cross-domain dependency

`VaultService` depends on `auth/repositories/webauthn-credential-repository` to validate PRF slots against registered credentials. Bootstrap constructs `VaultService` and injects it into `AuthService`; HTTP uses `services.vault`.
