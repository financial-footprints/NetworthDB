import { emptySchema, mfaChallengeSchema } from "@platform/auth/session";
import { vaultSlotDataSchema } from "@platform/auth/vault";
import { optionalNonEmptyString, requiredTrimmedString } from "@platform/fields";
import { dataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

// --- Password reset begin (POST /api/v1/auth/recovery/password/begin) ---

export const pwResetBeginReqSchema = z
  .object({
    username: z.string().trim().optional(),
    email: z.string().trim().optional(),
  })
  .superRefine((body, ctx) => {
    if ((body.username?.length ?? 0) === 0 || (body.email?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        message: "api.auth.recovery.email.invalid.missing-fields",
      });
    }
  })
  .transform((body) => ({
    username: body.username ?? "",
    email: body.email ?? "",
  }));

// --- Recovery token lookup (GET advanced context) ---

export const recoveryTokenReqSchema = z.object({
  token: requiredTrimmedString("api.auth.recovery.invalid.token-required"),
});

const advCtxDataSchema = z.object({
  e2ee_vault_initialized: z.boolean(),
  e2ee_slots: z.array(vaultSlotDataSchema),
  vault_recovery_methods: z.array(z.string()),
});

export const advCtxSchema = dataEnvelopeSchema(advCtxDataSchema);

// --- Password reset complete (POST /api/v1/auth/recovery/password/complete) ---

export const pwResetCompleteReqSchema = z
  .object({
    token: z.string().trim().optional(),
    new_password: z.string().optional(),
    password: optionalNonEmptyString(),
    totp: optionalNonEmptyString(),
    recovery_code: optionalNonEmptyString(),
    webauthn_session_id: optionalNonEmptyString(),
    webauthn_response: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((body) => ({
    token: body.token?.trim() ?? "",
    newPassword: body.new_password ?? "",
    multifactorProof: {
      password: body.password,
      totp: body.totp,
      recoveryCode: body.recovery_code,
      webauthnSessionId: body.webauthn_session_id,
      webauthnResponse: body.webauthn_response,
    },
  }));

const passwordSlotSchema = z
  .object({
    salt: z.string(),
    wrap_blob: z.string(),
  })
  .transform((slot) => ({
    salt: slot.salt,
    wrapBlob: slot.wrap_blob,
  }));

// --- Advanced recovery complete (POST /api/v1/auth/recovery/advanced/complete) ---

export const advCompleteReqSchema = z
  .object({
    token: z.string().trim().optional(),
    new_password: z.string().optional(),
    password_slot: passwordSlotSchema.optional(),
    webauthn_session_id: z.string().uuid().optional(),
    webauthn_response: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((body) => ({
    token: body.token ?? "",
    newPassword: body.new_password ?? "",
    passwordSlot:
      body.password_slot &&
      body.password_slot.salt.length > 0 &&
      body.password_slot.wrapBlob.length > 0
        ? body.password_slot
        : undefined,
    webauthnSessionId:
      body.webauthn_session_id && body.webauthn_session_id.length > 0
        ? body.webauthn_session_id
        : undefined,
    webauthnResponse: body.webauthn_response,
  }));

export const advCompleteSchema = z.union([mfaChallengeSchema, emptySchema]);
