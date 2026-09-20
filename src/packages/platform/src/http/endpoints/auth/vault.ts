import { VAULT_SLOT_TYPES } from "@core/domains/user/vault/constants";
import { detailsResponseSchema } from "@platform/http/envelopes";
import { optionalNonEmptyString, optionalTrimmedString } from "@platform/schema/fields";
import { z } from "zod";

export const vaultSlotDataSchema = z.object({
  id: z.string().uuid(),
  slotType: z.string(),
  salt: z.string(),
  wrapBlob: z.string(),
  credentialId: z.string().nullable(),
  label: z.string(),
});

const FORBIDDEN_VAULT_SECRET_KEYS = new Set([
  "phrase",
  "mnemonic",
  "recovery_phrase",
  "recovery_phrase_secret",
]);

function rejectForbiddenVaultSecrets(body: Record<string, unknown>, ctx: z.RefinementCtx): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_VAULT_SECRET_KEYS.has(key)) {
      ctx.addIssue({
        code: "custom",
        message: "Recovery secrets must not be sent as plaintext.",
        path: [key],
      });
    }
  }
}

function rejectUnknownVaultBodyKeys(
  body: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  ctx: z.RefinementCtx
): void {
  for (const key of Object.keys(body)) {
    if (allowedKeys.has(key) || FORBIDDEN_VAULT_SECRET_KEYS.has(key)) {
      continue;
    }
    ctx.addIssue({
      code: "unrecognized_keys",
      keys: [key],
      path: [key],
    });
  }
}

const VAULT_INIT_BODY_KEYS = new Set(["slots", "displayName"]);
const VAULT_ADD_SLOT_BODY_KEYS = new Set([
  "slotType",
  "salt",
  "wrapBlob",
  "label",
  "password",
  "credentialId",
]);
const VAULT_SLOT_UPDATE_BODY_KEYS = new Set(["salt", "wrapBlob", "password"]);

export const vaultSlotInputSchema = z
  .object({
    slotType: z.string().trim().optional(),
    salt: z.string().optional(),
    wrapBlob: z.string().optional(),
    label: z.string().optional(),
    password: z.string().optional(),
    credentialId: optionalNonEmptyString(),
  })
  .superRefine((body, ctx) => {
    const slotType = body.slotType ?? "";
    if (!VAULT_SLOT_TYPES.includes(slotType as (typeof VAULT_SLOT_TYPES)[number])) {
      ctx.addIssue({
        code: "custom",
        message: "Vault slot type is invalid.",
        path: ["slotType"],
      });
    }
  });

// --- Initialize vault (POST /api/v1/users/me/vault/initialize) ---

export const vaultInitReqSchema = z
  .object({
    slots: z.array(z.unknown()).optional(),
    displayName: optionalTrimmedString(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    rejectForbiddenVaultSecrets(body, ctx);
    rejectUnknownVaultBodyKeys(body, VAULT_INIT_BODY_KEYS, ctx);
    if (!Array.isArray(body.slots) || body.slots.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one vault slot is required.",
        path: ["slots"],
      });
    }
  })
  .transform((body) => ({
    slots: (body.slots ?? []).map((item) => vaultSlotInputSchema.parse(item)),
    displayName: body.displayName,
  }));

export const vaultSlotSchema = detailsResponseSchema(vaultSlotDataSchema);

// --- Add vault slot (POST /api/v1/users/me/vault/slots) ---

export const vaultAddSlotReqSchema = z
  .object({
    slotType: z.string().trim().optional(),
    salt: z.string().optional(),
    wrapBlob: z.string().optional(),
    label: z.string().optional(),
    password: z.string().optional(),
    credentialId: optionalNonEmptyString(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    rejectForbiddenVaultSecrets(body, ctx);
    rejectUnknownVaultBodyKeys(body, VAULT_ADD_SLOT_BODY_KEYS, ctx);
  })
  .transform((body) => vaultSlotInputSchema.parse(body));

const vaultSlotsDataSchema = z.object({
  vaultSlots: z.array(vaultSlotDataSchema),
});

export const vaultSlotsSchema = detailsResponseSchema(vaultSlotsDataSchema);

export const slotIdParamsSchema = z.object({
  slotId: z.string().uuid(),
});

// --- Update vault slot (PATCH /api/v1/users/me/vault/slots/:id) ---

export const vaultSlotUpdateReqSchema = z
  .object({
    salt: z.string().optional(),
    wrapBlob: z.string().optional(),
    password: optionalNonEmptyString(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    rejectForbiddenVaultSecrets(body, ctx);
    rejectUnknownVaultBodyKeys(body, VAULT_SLOT_UPDATE_BODY_KEYS, ctx);
  });

// --- Optional vault password (TOTP begin, recovery generate) ---

export const vaultPasswordReqSchema = z.preprocess(
  (value) => (value === undefined || value === null ? {} : value),
  z.object({
    password: optionalNonEmptyString(),
  })
);
