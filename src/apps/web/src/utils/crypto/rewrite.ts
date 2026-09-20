import { API, accountListSchema, accountSchema, apiPath } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { invalidateAllAccountCaches } from "@web/utils/api/routes/accounts/cache";
import type { AccountApi } from "@web/utils/api/routes/accounts/types";
import { fetchMe, patchMeWithToken } from "@web/utils/api/routes/auth";
import type { MeResponse } from "@web/utils/api/routes/auth/types";
import {
  type E2eeFieldId,
  resolveStoredField,
  withE2eeField,
} from "@web/utils/crypto/client-settings";
import { openField } from "@web/utils/crypto/vault";

async function listAccountApis(sessionToken: string): Promise<AccountApi[]> {
  const response = await apiRequest(API.accounts.list, {
    sessionToken,
    params: { status: "all" },
    schema: accountListSchema,
  });
  return response.items ?? [];
}

export async function rewriteE2eeFieldStorage(
  sessionToken: string,
  me: MeResponse,
  dek: CryptoKey,
  fieldId: E2eeFieldId,
  enable: boolean
): Promise<MeResponse> {
  if (fieldId === "display_name") {
    const stored = me.displayName ?? "";
    if (stored.trim()) {
      const plaintext = await openField(dek, stored);
      const wire = await resolveStoredField(dek, plaintext, enable);
      await patchMeWithToken(sessionToken, { displayName: wire });
    }
  } else {
    const accounts = await listAccountApis(sessionToken);
    for (const account of accounts) {
      const plaintext = await openField(dek, account.accountNumber);
      const wire = await resolveStoredField(dek, plaintext, enable);
      await apiRequest(apiPath(API.accounts.patch, { accountId: account.id }), {
        method: "PATCH",
        sessionToken,
        body: { accountNumber: wire },
        schema: accountSchema,
      });
    }
    invalidateAllAccountCaches();
  }

  const nextSettings = withE2eeField(me.clientSettings ?? null, fieldId, enable);
  await patchMeWithToken(sessionToken, { clientSettings: nextSettings });
  return fetchMe(sessionToken);
}

export function e2eeFieldToggleCopy(
  fieldLabel: string,
  enable: boolean
): { title: string; body: string; confirmLabel: string } {
  if (enable) {
    return {
      title: `Enable end-to-end encryption for ${fieldLabel}?`,
      body: "This field will be encrypted in your browser before it is sent. The server will store ciphertext it cannot read. Existing stored values will be rewritten now.",
      confirmLabel: "Enable encryption",
    };
  }
  return {
    title: `Disable end-to-end encryption for ${fieldLabel}?`,
    body: "This field will be decrypted in your browser and sent to the server in readable form. The server (and anyone with database access) will be able to read it. Existing stored values will be rewritten now.",
    confirmLabel: "Disable encryption",
  };
}
