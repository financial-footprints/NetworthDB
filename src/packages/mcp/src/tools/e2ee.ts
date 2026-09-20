import type { SessionStore } from "@mcp/auth/session-store";
import { API } from "@ndb/platform";

const BLOB_SEPARATOR = ".";
const MIN_SEALED_SEGMENT_LEN = 16;

type E2eeField = "account_number" | "display_name";

export function looksLikeE2eeBlob(blob: string): boolean {
  const trimmed = blob.trim();
  try {
    const dot = trimmed.indexOf(BLOB_SEPARATOR);
    if (dot <= 0 || dot === trimmed.length - 1) {
      return false;
    }
    const nonce = trimmed.slice(0, dot);
    const ciphertext = trimmed.slice(dot + 1);
    if (!nonce || !ciphertext || ciphertext.includes(BLOB_SEPARATOR)) {
      return false;
    }
    return nonce.length >= MIN_SEALED_SEGMENT_LEN && ciphertext.length >= MIN_SEALED_SEGMENT_LEN;
  } catch {
    return false;
  }
}

function isE2eeFieldEnabled(
  clientSettings: Record<string, unknown> | null | undefined,
  field: E2eeField
): boolean {
  if (!clientSettings || typeof clientSettings !== "object") {
    return true;
  }
  const e2ee = clientSettings.e2ee;
  if (!e2ee || typeof e2ee !== "object" || Array.isArray(e2ee)) {
    return true;
  }
  const toggle = (e2ee as Record<string, unknown>)[field];
  return toggle !== false;
}

async function assertE2eeFieldWritable(
  session: SessionStore,
  field: E2eeField,
  value: string,
  errorCode: string,
  uiHint: string
): Promise<void> {
  const me = await session.getJson<{ clientSettings?: Record<string, unknown> | null }>(
    API.users.me.get
  );
  if (!isE2eeFieldEnabled(me.clientSettings ?? null, field)) {
    return;
  }
  if (looksLikeE2eeBlob(value)) {
    return;
  }
  throw new Error(
    `${errorCode}: disable ${uiHint} E2EE in Profile → Encryption (web UI), or pass an existing sealed blob unchanged.`
  );
}

export async function assertAccountNumberWritable(
  session: SessionStore,
  accountNumber: string
): Promise<void> {
  await assertE2eeFieldWritable(
    session,
    "account_number",
    accountNumber,
    "mcp.e2ee.account_number.unsupported",
    "Account Number"
  );
}

export async function assertDisplayNameWritable(
  session: SessionStore,
  displayName: string
): Promise<void> {
  await assertE2eeFieldWritable(
    session,
    "display_name",
    displayName,
    "mcp.e2ee.display_name.unsupported",
    "Display Name"
  );
}
