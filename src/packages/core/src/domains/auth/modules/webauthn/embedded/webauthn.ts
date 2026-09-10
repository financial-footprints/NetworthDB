import type { WebAuthnCredential } from "@core/domains/auth/modules/webauthn/entities/webauthn-credential";
import type { User } from "@core/domains/user/entities/user/index";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

export type WebAuthnRpConfig = {
  rpDisplayName: string;
  rpId: string;
  rpOrigins: string[];
};

type CeremonyKind = "registration" | "authentication";

type CeremonyBlob = {
  kind: CeremonyKind;
  stepUpSatisfied: boolean;
  options: PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON;
};

export function encodeCeremonyBlob(blob: CeremonyBlob): Buffer {
  return Buffer.from(JSON.stringify(blob), "utf8");
}

export function decodeCeremonyBlob(data: Buffer): CeremonyBlob {
  const parsed = JSON.parse(data.toString("utf8")) as CeremonyBlob;
  if (!parsed.kind || !parsed.options) {
    throw new Error("core.auth.webauthn.ceremony.invalid.blob");
  }

  return parsed;
}

function userIdBuffer(user: User): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(user.id) as Uint8Array<ArrayBuffer>;
}

export async function createRegistrationOptions(
  config: WebAuthnRpConfig,
  user: User,
  credentials: WebAuthnCredential[]
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return generateRegistrationOptions({
    rpName: config.rpDisplayName,
    rpID: config.rpId,
    userName: user.username.toString(),
    userDisplayName: user.username.toString(),
    userID: userIdBuffer(user),
    attestationType: "none",
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credentialId.toString("base64url"),
      transports:
        credential.transport.length > 0
          ? (credential.transport.split(",") as AuthenticatorTransportFuture[])
          : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function createAuthenticationOptions(
  config: WebAuthnRpConfig,
  _user: User,
  credentials: WebAuthnCredential[]
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: "preferred",
    allowCredentials: credentials.map((credential) => ({
      id: credential.credentialId.toString("base64url"),
      transports:
        credential.transport.length > 0
          ? (credential.transport.split(",") as AuthenticatorTransportFuture[])
          : undefined,
    })),
  });
}

export async function verifyRegistration(
  config: WebAuthnRpConfig,
  options: PublicKeyCredentialCreationOptionsJSON,
  response: RegistrationResponseJSON
) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge: options.challenge,
    expectedOrigin: config.rpOrigins,
    expectedRPID: config.rpId,
    requireUserVerification: false,
  });
}

export async function verifyAuthentication(
  config: WebAuthnRpConfig,
  options: PublicKeyCredentialRequestOptionsJSON,
  response: AuthenticationResponseJSON,
  credential: WebAuthnCredential
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge: options.challenge,
    expectedOrigin: config.rpOrigins,
    expectedRPID: config.rpId,
    requireUserVerification: false,
    credential: {
      id: credential.credentialId.toString("base64url"),
      publicKey: new Uint8Array(credential.publicKey),
      counter: credential.signCount,
      transports:
        credential.transport.length > 0
          ? (credential.transport.split(",") as AuthenticatorTransportFuture[])
          : undefined,
    },
  });
}
