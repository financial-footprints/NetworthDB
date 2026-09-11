export type WebAuthnCeremonyKind = "registration" | "authentication";

export type WebAuthnCeremonyBlob = {
  kind: WebAuthnCeremonyKind;
  stepUpSatisfied: boolean;
  options: Record<string, unknown>;
};

export function encodeWebAuthnCeremonyBlob(blob: WebAuthnCeremonyBlob): Buffer {
  return Buffer.from(JSON.stringify(blob), "utf8");
}

export function decodeWebAuthnCeremonyBlob(data: Buffer): WebAuthnCeremonyBlob {
  const parsed = JSON.parse(data.toString("utf8")) as WebAuthnCeremonyBlob;
  if (!parsed.kind || !parsed.options) {
    throw new Error("core.auth.webauthn.ceremony.invalid.blob");
  }

  return parsed;
}
