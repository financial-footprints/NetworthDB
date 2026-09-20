import { mfaChallengeSchema } from "@platform/http/endpoints/auth/session";
import { vaultSlotDataSchema } from "@platform/http/endpoints/auth/vault";
import { detailsResponseSchema } from "@platform/http/envelopes";
import { optionalNonEmptyString, requiredTrimmedString } from "@platform/schema/fields";
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
        message: "Required fields are missing.",
      });
    }
  });

// --- Recovery token lookup (GET advanced context) ---

export const recoveryTokenReqSchema = z.object({
  token: requiredTrimmedString("Token is required."),
});

const advCtxDataSchema = z.object({
  vaultInitialized: z.boolean(),
  vaultSlots: z.array(vaultSlotDataSchema),
  vaultRecoveryMethods: z.array(z.string()),
});

export const advCtxSchema = detailsResponseSchema(advCtxDataSchema);

// --- Password reset complete (POST /api/v1/auth/recovery/password/complete) ---

export const pwResetCompleteReqSchema = z.object({
  token: z.string().trim().optional(),
  newPassword: z.string().optional(),
  password: optionalNonEmptyString(),
  totp: optionalNonEmptyString(),
  recoveryCode: optionalNonEmptyString(),
  webauthnSessionId: optionalNonEmptyString(),
  webauthnResponse: z.record(z.string(), z.unknown()).optional(),
});

const passwordSlotSchema = z.object({
  salt: z.string(),
  wrapBlob: z.string(),
});

// --- Advanced recovery complete (POST /api/v1/auth/recovery/advanced/complete) ---

export const advCompleteReqSchema = z.object({
  token: z.string().trim().optional(),
  newPassword: z.string().optional(),
  passwordSlot: passwordSlotSchema.optional(),
  webauthnSessionId: z.string().uuid().optional(),
  webauthnResponse: z.record(z.string(), z.unknown()).optional(),
});

export const advCompleteSchema = mfaChallengeSchema;
