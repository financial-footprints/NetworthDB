import { createPasswordHasher } from "@auth/crypto/password";
import { createSecretBox } from "@auth/crypto/secrets";
import { createTokenDigest } from "@auth/crypto/tokens";
import { createTotpEngine } from "@auth/crypto/totp";
import { createWebAuthnRelyingParty } from "@auth/crypto/webauthn";
import type { AuthCrypto, WebAuthnRpConfig } from "@ndb/core";

type CreateAuthCryptoConfig = {
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
