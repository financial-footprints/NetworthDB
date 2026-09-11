import type { SecretBox } from "@ndb/core";
import { decryptString, encryptString } from "@ndb/encryption";

export function createSecretBox(encryptionKey: Buffer): SecretBox {
  return {
    encrypt(plain: string) {
      return encryptString(encryptionKey, plain);
    },

    decrypt(blob: Buffer) {
      return decryptString(encryptionKey, blob);
    },
  };
}
