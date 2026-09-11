import { withSessionToken } from "@web/utils/api/endpoints/auth";
import { readDEK } from "@web/utils/crypto/session";

export const VAULT_LOCKED_MESSAGE = "Vault is locked";

export async function withVaultDek<T>(
  fn: (sessionToken: string, dek: CryptoKey) => Promise<T>
): Promise<T> {
  return withSessionToken(async (sessionToken) => {
    const dek = await readDEK();
    if (!dek) {
      throw new Error(VAULT_LOCKED_MESSAGE);
    }
    return fn(sessionToken, dek);
  });
}
