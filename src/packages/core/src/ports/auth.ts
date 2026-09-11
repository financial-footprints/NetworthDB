import type { WebAuthnCredential } from "@core/domains/auth/entities/webauthn-credential";

export type PasswordHasher = {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
};

export type TotpValidateResult = {
  valid: boolean;
  step: number;
};

export type TotpEngine = {
  generateSecret(username: string): { secret: string; uri: string };
  provisioningUri(username: string, secretBase32: string): string;
  validate(
    secretBase32: string,
    code: string,
    skew: number,
    lastStep: number | null
  ): TotpValidateResult;
  currentStep(): number;
};

export type SecretBox = {
  encrypt(plain: string): Buffer;
  decrypt(blob: Buffer): string;
};

export type TokenDigest = {
  randomHex(byteLength: number): string;
  randomBase64Url(byteLength: number): string;
  sha256Hex(value: string): string;
};

export type WebAuthnRpConfig = {
  rpDisplayName: string;
  rpId: string;
  rpOrigins: string[];
};

export type WebAuthnRegistrationOptions = Record<string, unknown>;
export type WebAuthnAuthenticationOptions = Record<string, unknown>;

export type WebAuthnRegistrationVerified = {
  verified: boolean;
  credentialId: Buffer;
  publicKey: Buffer;
  attestationType: string;
  transports: string;
  counter: number;
  multiDevice: boolean;
  backedUp: boolean;
};

export type WebAuthnAuthenticationVerified = {
  verified: boolean;
  newCounter: number;
  credentialBackedUp: boolean;
};

export type WebAuthnRelyingParty = {
  isConfigured(): boolean;
  createRegistrationOptions(
    user: { username: string },
    credentials: WebAuthnCredential[]
  ): Promise<WebAuthnRegistrationOptions>;
  createAuthenticationOptions(
    user: { username: string },
    credentials: WebAuthnCredential[]
  ): Promise<WebAuthnAuthenticationOptions>;
  verifyRegistration(
    options: WebAuthnRegistrationOptions,
    response: Record<string, unknown>
  ): Promise<WebAuthnRegistrationVerified>;
  verifyAuthentication(
    options: WebAuthnAuthenticationOptions,
    response: Record<string, unknown>,
    credential: WebAuthnCredential
  ): Promise<WebAuthnAuthenticationVerified>;
};

export type AuthCrypto = {
  password: PasswordHasher;
  totp: TotpEngine;
  secrets: SecretBox;
  tokens: TokenDigest;
  webauthn: WebAuthnRelyingParty;
};
