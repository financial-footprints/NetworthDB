import { createHash, randomBytes } from "node:crypto";
import type { TokenDigest } from "@ndb/core";

export function createTokenDigest(): TokenDigest {
  return {
    randomHex(byteLength: number) {
      return randomBytes(byteLength).toString("hex");
    },

    randomBase64Url(byteLength: number) {
      return randomBytes(byteLength).toString("base64url");
    },

    sha256Hex(value: string) {
      return createHash("sha256").update(value).digest("hex");
    },
  };
}
