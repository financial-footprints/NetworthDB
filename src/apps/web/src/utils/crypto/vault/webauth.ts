import type { AuthenticationExtensionsClientInputs as SimpleWebAuthnExtensions } from "@simplewebauthn/browser";
import type { VaultSlot } from "@web/utils/api/routes/auth/types";
import {
  asBufferSource,
  decodeBase64url,
  encodeBase64url,
  randomBytes,
} from "@web/utils/crypto/aes";
import { credentialIdsMatch } from "@web/utils/crypto/vault/slots";
import type { WebAuthnUnlockContext } from "@web/utils/crypto/vault/types";

type PrfExtensionResults = {
  first?: BufferSource;
  second?: BufferSource;
};

function filterWebAuthnPrfSlots(slots: VaultSlot[]): VaultSlot[] {
  return slots.filter((slot) => slot.slotType === "webauthn_prf");
}

export function buildPrfAuthenticationExtensions(
  slots: VaultSlot[]
): SimpleWebAuthnExtensions | undefined {
  const prfSlots = filterWebAuthnPrfSlots(slots);
  if (prfSlots.length === 0) {
    return undefined;
  }

  return {
    prf: {
      eval: {
        first: asBufferSource(decodeBase64url(prfSlots[0].salt)),
        ...(prfSlots[1] ? { second: asBufferSource(decodeBase64url(prfSlots[1].salt)) } : {}),
      },
    },
  };
}

export function extractWebAuthnUnlockContext(
  credentialId: string,
  clientExtensionResults: unknown,
  prfSlots: VaultSlot[]
): WebAuthnUnlockContext | null {
  const results = readPrfResults(clientExtensionResults);
  if (!results) {
    return null;
  }

  const slotIndex = prfSlots.findIndex((slot) =>
    credentialIdsMatch(slot.credentialId, credentialId)
  );
  if (slotIndex === -1) {
    return null;
  }

  const output = slotIndex === 0 ? results.first : slotIndex === 1 ? results.second : undefined;
  if (!output) {
    return null;
  }

  return {
    credentialId,
    prfOutput: new Uint8Array(output),
  };
}

export async function registerVaultPrf(
  credentialIdBase64: string,
  prfSalt: Uint8Array,
  evalSlot: "first" | "second" = "first"
): Promise<Uint8Array> {
  const extensions = {
    prf: {
      eval:
        evalSlot === "first"
          ? { first: asBufferSource(prfSalt) }
          : { second: asBufferSource(prfSalt) },
    },
  } as SimpleWebAuthnExtensions;

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: asBufferSource(randomBytes(32)),
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: asBufferSource(decodeBase64url(credentialIdBase64)),
          type: "public-key" as const,
        },
      ],
      userVerification: "required",
      extensions: extensions as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey authentication was cancelled.");
  }

  const results = readPrfResults(credential.getClientExtensionResults());
  const output = evalSlot === "first" ? results?.first : results?.second;
  if (!output) {
    throw new Error("This passkey did not return vault key material. Try another passkey.");
  }
  return new Uint8Array(output);
}

export async function authenticateVaultPrf(prfSlots: VaultSlot[]): Promise<WebAuthnUnlockContext> {
  const extensions = buildPrfAuthenticationExtensions(prfSlots);
  if (!extensions) {
    throw new Error("No passkey vault slots configured.");
  }

  const allowCredentials = prfSlots
    .filter((slot) => slot.credentialId)
    .map((slot) => ({
      id: asBufferSource(decodeBase64url(slot.credentialId as string)),
      type: "public-key" as const,
    }));

  if (allowCredentials.length === 0) {
    throw new Error("No passkey vault slots configured.");
  }

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: asBufferSource(randomBytes(32)),
      rpId: window.location.hostname,
      allowCredentials,
      userVerification: "required",
      extensions: extensions as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey authentication was cancelled.");
  }

  const credentialId = encodeBase64url(new Uint8Array(credential.rawId));
  const clientExtensionResults = credential.getClientExtensionResults();
  const context = extractWebAuthnUnlockContext(credentialId, clientExtensionResults, prfSlots);
  if (!context) {
    throw new Error("This passkey did not return vault key material. Try another unlock method.");
  }
  return context;
}

function readPrfResults(
  clientExtensionResults: unknown
): { first?: ArrayBuffer; second?: ArrayBuffer } | null {
  if (!clientExtensionResults || typeof clientExtensionResults !== "object") {
    return null;
  }
  const prf = (clientExtensionResults as { prf?: { results?: PrfExtensionResults } }).prf?.results;
  if (!prf) {
    return null;
  }
  return {
    first: toArrayBuffer(prf.first),
    second: toArrayBuffer(prf.second),
  };
}

function toArrayBuffer(value: BufferSource | undefined): ArrayBuffer | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value instanceof ArrayBuffer) {
    return value;
  }
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}
