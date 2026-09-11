import { createPasswordHasher } from "@auth/password";
import { createSecretBox } from "@auth/secrets";
import { createTokenDigest } from "@auth/tokens";
import { createTotpEngine } from "@auth/totp";
import { createWebAuthnRelyingParty } from "@auth/webauthn";
import type { AuthCrypto, WebAuthnRpConfig } from "@ndb/core";

export type CreateAuthCryptoConfig = {
  mfaEncryptionKey: Buffer;
  webauthn: WebAuthnRpConfig | null;
};

export function createAuthCrypto(config: CreateAuthCryptoConfig): AuthCrypto {
  return {
    password: createPasswordHasher(),
    totp: createTotpEngine(),
    secrets: createSecretBox(config.mfaEncryptionKey),
    tokens: createTokenDigest(),
    webauthn: createWebAuthnRelyingParty(config.webauthn),
  };
}
