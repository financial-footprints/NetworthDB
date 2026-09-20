import type { SecretBox } from "@ndb/core";
import { decrypt, encrypt } from "@ndb/encryption";

export function createSecretBox(encryptionKey: Buffer): SecretBox {
  return {
    encrypt(plain: string) {
      return encrypt(encryptionKey, Buffer.from(plain, "utf8"));
    },

    decrypt(blob: Buffer) {
      return decrypt(encryptionKey, blob).toString("utf8");
    },
  };
}
