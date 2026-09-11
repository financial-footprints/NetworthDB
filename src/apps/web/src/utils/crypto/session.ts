import { decodeBase64url, encodeBase64url, exportDEK, importDEK } from "@web/utils/crypto/aes";

const DEK_KEY = "networth_vault_dek";

/** Persist DEK for this browser tab (cleared on logout). */
export async function writeDEK(dek: CryptoKey): Promise<void> {
  const raw = await exportDEK(dek);
  sessionStorage.setItem(DEK_KEY, encodeBase64url(raw));
}

export async function readDEK(): Promise<CryptoKey | null> {
  try {
    const stored = sessionStorage.getItem(DEK_KEY);
    if (!stored) {
      return null;
    }
    return importDEK(decodeBase64url(stored));
  } catch {
    return null;
  }
}

export function clearDEK(): void {
  try {
    sessionStorage.removeItem(DEK_KEY);
  } catch {
    // ignore
  }
}
