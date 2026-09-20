import {
  isVaultSlotType,
  MAX_VAULT_NONCE_LEN,
  MAX_VAULT_SLOT_LABEL,
  MAX_VAULT_WRAP_BLOB_LEN,
  MAX_VAULT_WRAP_CT_LEN,
  type VaultSlotType,
} from "@core/domains/user/vault/constants";
import { ValidationError } from "@core/shared/errors/domain-error";

export type { VaultSlotType } from "@core/domains/user/vault/constants";
export { VAULT_SLOT_TYPES } from "@core/domains/user/vault/constants";

const MAX_VAULT_SALT_LEN = 64;
const WRAP_BLOB_SEPARATOR = ".";

export class VaultSlot {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly slotType: VaultSlotType,
    public readonly salt: string,
    public readonly wrapBlob: string,
    public readonly label: string,
    public readonly credentialId: Buffer | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(props: {
    userId: string;
    slotType: string;
    salt: string;
    wrapBlob: string;
    label?: string | null;
    credentialId?: Buffer | null;
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): VaultSlot {
    const slotType = VaultSlot.parseSlotType(props.slotType);
    const salt = VaultSlot.normalizeSalt(props.salt);
    const wrapBlob = VaultSlot.normalizeWrapBlob(props.wrapBlob);
    const label = VaultSlot.normalizeLabel(props.label ?? "");
    const now = props.createdAt ?? new Date();

    return new VaultSlot(
      props.id ?? crypto.randomUUID(),
      props.userId,
      slotType,
      salt,
      wrapBlob,
      label,
      props.credentialId ?? null,
      now,
      props.updatedAt ?? now
    );
  }

  static packWrap(nonce: string, ciphertext: string): string {
    return `${nonce}${WRAP_BLOB_SEPARATOR}${ciphertext}`;
  }

  static unpackWrap(blob: string): { nonce: string; ciphertext: string } {
    const trimmed = blob.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Vault blob is required.");
    }

    const dot = trimmed.indexOf(WRAP_BLOB_SEPARATOR);
    if (dot <= 0 || dot === trimmed.length - 1) {
      throw new ValidationError("Vault blob format is invalid.");
    }

    const nonce = trimmed.slice(0, dot);
    const ciphertext = trimmed.slice(dot + 1);
    if (nonce.length === 0 || ciphertext.length === 0) {
      throw new ValidationError("Vault blob format is invalid.");
    }

    return { nonce, ciphertext };
  }

  static encodeCredentialId(raw: Uint8Array): string {
    if (raw.length === 0) {
      return "";
    }

    return VaultSlot.toBase64Url(raw);
  }

  static parseCredentialId(encoded: string): Buffer {
    const trimmed = encoded.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Credential id is invalid.");
    }

    try {
      const bytes = VaultSlot.fromBase64Url(trimmed);
      if (bytes.length === 0) {
        throw new ValidationError("Credential id is invalid.");
      }

      return Buffer.from(bytes);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError("Credential id is invalid.");
    }
  }

  withWrap(salt: string, wrapBlob: string, updatedAt: Date): VaultSlot {
    return new VaultSlot(
      this.id,
      this.userId,
      this.slotType,
      VaultSlot.normalizeSalt(salt),
      VaultSlot.normalizeWrapBlob(wrapBlob),
      this.label,
      this.credentialId,
      this.createdAt,
      updatedAt
    );
  }

  private static parseSlotType(slotType: string): VaultSlotType {
    const trimmed = slotType.trim();
    if (!isVaultSlotType(trimmed)) {
      throw new ValidationError("Vault slot type is invalid.");
    }

    return trimmed;
  }

  private static normalizeSalt(salt: string): string {
    const trimmed = salt.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_VAULT_SALT_LEN) {
      throw new ValidationError("Vault slot salt is invalid.");
    }

    return trimmed;
  }

  private static normalizeWrapBlob(blob: string): string {
    const trimmed = blob.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_VAULT_WRAP_BLOB_LEN) {
      throw new ValidationError("Vault slot wrap is invalid.");
    }

    try {
      const { nonce, ciphertext } = VaultSlot.unpackWrap(trimmed);
      if (nonce.length > MAX_VAULT_NONCE_LEN || ciphertext.length > MAX_VAULT_WRAP_CT_LEN) {
        throw new ValidationError("Vault slot wrap is invalid.");
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError("Vault slot wrap is invalid.");
    }

    return trimmed;
  }

  private static normalizeLabel(label: string): string {
    const trimmed = label.trim();
    if (trimmed.length > MAX_VAULT_SLOT_LABEL) {
      throw new ValidationError("Vault slot label is invalid.");
    }

    return trimmed;
  }

  private static toBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  private static fromBase64Url(value: string): Uint8Array {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const binary = atob(`${padded}${"=".repeat(padLength)}`);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }
}
