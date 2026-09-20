import type { ActivePeriodStored } from "@web/utils/active-period";
import { parseActivePeriodStored } from "@web/utils/active-period";
import { VAULT_LOCKED_MESSAGE } from "@web/utils/api/helpers";
import { sealField } from "@web/utils/crypto/vault";

export type E2eeFieldId = "display_name" | "account_number";

export type ClientSettingsPayload = {
  e2ee?: Partial<Record<E2eeFieldId, boolean>>;
  active_period?: ActivePeriodStored;
};

function parseE2ee(raw: unknown): Partial<Record<E2eeFieldId, boolean>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const source = raw as Record<string, unknown>;
  const out: Partial<Record<E2eeFieldId, boolean>> = {};

  if (typeof source.display_name === "boolean") {
    out.display_name = source.display_name;
  } else if (typeof source.displayName === "boolean") {
    out.display_name = source.displayName;
  }

  if (typeof source.account_number === "boolean") {
    out.account_number = source.account_number;
  } else if (typeof source.accountNumber === "boolean") {
    out.account_number = source.accountNumber;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseClientSettings(
  raw: Record<string, unknown> | null | undefined
): ClientSettingsPayload {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result: ClientSettingsPayload = {};

  const e2ee = parseE2ee(raw.e2ee);
  if (e2ee) {
    result.e2ee = e2ee;
  }

  if (raw.active_period !== undefined) {
    result.active_period = parseActivePeriodStored(raw.active_period);
  }

  return result;
}

export function isE2eeEnabled(settings: ClientSettingsPayload, field: E2eeFieldId): boolean {
  return settings.e2ee?.[field] !== false;
}

export function withE2eeField(
  current: Record<string, unknown> | null,
  field: E2eeFieldId,
  enabled: boolean
): Record<string, unknown> {
  const base = current ? { ...current } : {};
  const previousE2ee =
    typeof base.e2ee === "object" && base.e2ee !== null && !Array.isArray(base.e2ee)
      ? (base.e2ee as Record<string, unknown>)
      : {};
  return {
    ...base,
    e2ee: {
      ...previousE2ee,
      [field]: enabled,
    },
  };
}

export async function resolveStoredField(
  dek: CryptoKey | null,
  plaintext: string,
  encrypt: boolean
): Promise<string> {
  const trimmed = plaintext.trim();
  if (!encrypt) {
    return trimmed;
  }
  if (!dek) {
    throw new Error(VAULT_LOCKED_MESSAGE);
  }
  return sealField(dek, trimmed);
}
