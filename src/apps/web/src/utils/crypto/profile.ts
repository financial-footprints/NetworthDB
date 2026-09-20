import type { AuthUser, MeResponse } from "@web/utils/api/routes/auth/types";
import { looksLikeE2eeBlob, openField } from "@web/utils/crypto/vault/fields";

/**
 * Decrypt display name when the vault DEK is available; otherwise show plaintext only.
 */
export async function decryptDisplayName(
  me: MeResponse,
  dek: CryptoKey | null
): Promise<string | null> {
  if (!me.displayName) {
    return null;
  }

  if (dek) {
    try {
      return await openField(dek, me.displayName);
    } catch {
      return null;
    }
  }

  return looksLikeE2eeBlob(me.displayName) ? null : me.displayName.trim();
}

export function meToAuthUser(me: MeResponse, name: string | null): AuthUser {
  return {
    id: me.id,
    username: me.username,
    role: me.role,
    multifactorEnabled: me.multifactorEnabled,
    multifactorMethods: me.multifactorMethods,
    recoveryCodesEnabled: me.recoveryCodesEnabled,
    recoveryEmailEnabled: me.recoveryEmailEnabled,
    displayName: name,
  };
}
