import { isVaultSlotType, type VaultSlotType } from "@core/domains/user/vault/constants";
import type { VaultSlotPublic } from "@core/domains/user/vault/types";

export type BackupVaultSlotRow = {
  slot_type: VaultSlotType;
  salt: string;
  wrap_blob: string;
  label: string;
  credential_id: string | null;
};

export type BackupVaultFile = {
  slots: BackupVaultSlotRow[];
};

export function serializeVaultSlots(slots: VaultSlotPublic[]): BackupVaultFile {
  return {
    slots: slots.map((slot) => ({
      slot_type: slot.slotType,
      salt: slot.salt,
      wrap_blob: slot.wrapBlob,
      label: slot.label,
      credential_id: slot.credentialId,
    })),
  };
}

function parseVaultSlotRow(entry: unknown): BackupVaultSlotRow | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const slotType = typeof row.slot_type === "string" ? row.slot_type : "";
  if (!isVaultSlotType(slotType)) {
    return null;
  }
  if (typeof row.salt !== "string" || typeof row.wrap_blob !== "string") {
    return null;
  }
  return {
    slot_type: slotType,
    salt: row.salt,
    wrap_blob: row.wrap_blob,
    label: typeof row.label === "string" ? row.label : "",
    credential_id: typeof row.credential_id === "string" ? row.credential_id : null,
  };
}

export function parseVaultFile(raw: string): BackupVaultFile {
  const parsed = JSON.parse(raw) as { slots?: unknown };
  if (!Array.isArray(parsed.slots)) {
    return { slots: [] };
  }

  const slots: BackupVaultSlotRow[] = [];
  for (const entry of parsed.slots) {
    const row = parseVaultSlotRow(entry);
    if (row) {
      slots.push(row);
    }
  }

  return { slots };
}
