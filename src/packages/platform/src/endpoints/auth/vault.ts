import { optionalNonEmptyString, optionalTrimmedString } from "@platform/fields";
import { dataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

export const vaultSlotDataSchema = z.object({
  id: z.string().uuid(),
  slot_type: z.string(),
  salt: z.string(),
  wrap_blob: z.string(),
  credential_id: z.string().nullable(),
  label: z.string(),
});

const VAULT_SLOT_TYPES = ["password", "recovery_phrase", "webauthn_prf"] as const;

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
        message: "core.auth.vault.initialize.invalid.plaintext-recovery-secrets",
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

const VAULT_INIT_BODY_KEYS = new Set(["slots", "display_name"]);
const VAULT_ADD_SLOT_BODY_KEYS = new Set([
  "slot_type",
  "salt",
  "wrap_blob",
  "label",
  "password",
  "credential_id",
]);
const VAULT_SLOT_UPDATE_BODY_KEYS = new Set(["salt", "wrap_blob", "password"]);

export const vaultSlotInputSchema = z
  .object({
    slot_type: z.string().trim().optional(),
    salt: z.string().optional(),
    wrap_blob: z.string().optional(),
    label: z.string().optional(),
    password: z.string().optional(),
    credential_id: optionalNonEmptyString(),
  })
  .superRefine((body, ctx) => {
    const slotType = body.slot_type ?? "";
    if (!VAULT_SLOT_TYPES.includes(slotType as (typeof VAULT_SLOT_TYPES)[number])) {
      ctx.addIssue({
        code: "custom",
        message: "api.auth.vault.slot.invalid.type",
        path: ["slot_type"],
      });
    }
  })
  .transform((body) => {
    const slotType = (body.slot_type ?? "").trim() as (typeof VAULT_SLOT_TYPES)[number];
    return {
      slotType,
      salt: body.salt ?? "",
      wrapBlob: body.wrap_blob ?? "",
      label: body.label ?? "",
      password: body.password,
      credentialId: body.credential_id,
    };
  });

// --- Initialize vault (POST /api/v1/users/me/vault/initialize) ---

export const vaultInitReqSchema = z
  .object({
    slots: z.array(z.unknown()).optional(),
    display_name: optionalTrimmedString(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    rejectForbiddenVaultSecrets(body, ctx);
    rejectUnknownVaultBodyKeys(body, VAULT_INIT_BODY_KEYS, ctx);
    if (!Array.isArray(body.slots) || body.slots.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "api.auth.vault.initialize.invalid.no-slots",
        path: ["slots"],
      });
    }
  })
  .transform((body) => ({
    slots: (body.slots ?? []).map((item) => vaultSlotInputSchema.parse(item)),
    displayName: body.display_name,
  }));

export const vaultSlotSchema = dataEnvelopeSchema(vaultSlotDataSchema);

// --- Add vault slot (POST /api/v1/users/me/vault/slots) ---

export const vaultAddSlotReqSchema = z
  .object({
    slot_type: z.string().trim().optional(),
    salt: z.string().optional(),
    wrap_blob: z.string().optional(),
    label: z.string().optional(),
    password: z.string().optional(),
    credential_id: optionalNonEmptyString(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    rejectForbiddenVaultSecrets(body, ctx);
    rejectUnknownVaultBodyKeys(body, VAULT_ADD_SLOT_BODY_KEYS, ctx);
  })
  .transform((body) => vaultSlotInputSchema.parse(body));

const vaultSlotsDataSchema = z.object({
  vault_slots: z.array(vaultSlotDataSchema),
});

export const vaultSlotsSchema = dataEnvelopeSchema(vaultSlotsDataSchema);

// --- Update vault slot (PATCH /api/v1/users/me/vault/slots/:id) ---

export const vaultSlotUpdateReqSchema = z
  .object({
    salt: z.string().optional(),
    wrap_blob: z.string().optional(),
    password: optionalNonEmptyString(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    rejectForbiddenVaultSecrets(body, ctx);
    rejectUnknownVaultBodyKeys(body, VAULT_SLOT_UPDATE_BODY_KEYS, ctx);
  })
  .transform((body) => ({
    salt: body.salt ?? "",
    wrapBlob: body.wrap_blob ?? "",
    password: body.password,
  }));

// --- Optional vault password (TOTP begin, recovery generate) ---

export const vaultPasswordReqSchema = z.preprocess(
  (value) => (value === undefined || value === null ? {} : value),
  z
    .object({
      password: optionalNonEmptyString(),
    })
    .transform((body) => body.password)
);
