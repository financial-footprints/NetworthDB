import type {
  WebAuthnAuthenticationOptions,
  WebAuthnAuthenticationVerified,
  WebAuthnCredential,
  WebAuthnRegistrationOptions,
  WebAuthnRegistrationVerified,
  WebAuthnRelyingParty,
  WebAuthnRpConfig,
} from "@ndb/core";
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

function userIdBuffer(userId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(userId) as Uint8Array<ArrayBuffer>;
}

export function createWebAuthnRelyingParty(config: WebAuthnRpConfig | null): WebAuthnRelyingParty {
  return {
    isConfigured() {
      return config !== null;
    },

    async createRegistrationOptions(
      user: { username: string },
      credentials: WebAuthnCredential[]
    ): Promise<WebAuthnRegistrationOptions> {
      if (!config) {
        throw new Error("core.auth.webauthn.invalid.not-configured");
      }

      const options = await generateRegistrationOptions({
        rpName: config.rpDisplayName,
        rpID: config.rpId,
        userName: user.username,
        userDisplayName: user.username,
        userID: userIdBuffer(user.username),
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

      return options as unknown as WebAuthnRegistrationOptions;
    },

    async createAuthenticationOptions(
      _user: { username: string },
      credentials: WebAuthnCredential[]
    ): Promise<WebAuthnAuthenticationOptions> {
      if (!config) {
        throw new Error("core.auth.webauthn.invalid.not-configured");
      }

      const options = await generateAuthenticationOptions({
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

      return options as unknown as WebAuthnAuthenticationOptions;
    },

    async verifyRegistration(
      options: WebAuthnRegistrationOptions,
      response: Record<string, unknown>
    ): Promise<WebAuthnRegistrationVerified> {
      if (!config) {
        throw new Error("core.auth.webauthn.invalid.not-configured");
      }

      const verified = await verifyRegistrationResponse({
        response: response as unknown as RegistrationResponseJSON,
        expectedChallenge: (options as unknown as PublicKeyCredentialCreationOptionsJSON).challenge,
        expectedOrigin: config.rpOrigins,
        expectedRPID: config.rpId,
        requireUserVerification: false,
      });

      if (!verified.verified || !verified.registrationInfo) {
        return {
          verified: false,
          credentialId: Buffer.alloc(0),
          publicKey: Buffer.alloc(0),
          attestationType: "none",
          transports: "",
          counter: 0,
          multiDevice: false,
          backedUp: false,
        };
      }

      const info = verified.registrationInfo;
      return {
        verified: true,
        credentialId: Buffer.from(info.credential.id),
        publicKey: Buffer.from(info.credential.publicKey),
        attestationType: info.attestationObject ? "packed" : "none",
        transports: info.credential.transports?.join(",") ?? "",
        counter: info.credential.counter,
        multiDevice: info.credentialDeviceType === "multiDevice",
        backedUp: info.credentialBackedUp,
      };
    },

    async verifyAuthentication(
      options: WebAuthnAuthenticationOptions,
      response: Record<string, unknown>,
      credential: WebAuthnCredential
    ): Promise<WebAuthnAuthenticationVerified> {
      if (!config) {
        throw new Error("core.auth.webauthn.invalid.not-configured");
      }

      const verified = await verifyAuthenticationResponse({
        response: response as unknown as AuthenticationResponseJSON,
        expectedChallenge: (options as unknown as PublicKeyCredentialRequestOptionsJSON).challenge,
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

      return {
        verified: verified.verified,
        newCounter: verified.authenticationInfo?.newCounter ?? credential.signCount,
        credentialBackedUp:
          verified.authenticationInfo?.credentialBackedUp ?? credential.backupState,
      };
    },
  };
}
