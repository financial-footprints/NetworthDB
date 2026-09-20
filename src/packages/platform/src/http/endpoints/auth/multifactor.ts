import { detailsResponseSchema, paginatedListResponseSchema } from "@platform/http/envelopes";
import { optionalNonEmptyString, requiredTrimmedString } from "@platform/schema/fields";
import { z } from "zod";

// --- Multifactor proof (POST /api/v1/users/me/totp/begin, /codes, /webauthn/register/begin) ---

export const mfaProofReqSchema = z.preprocess(
  (value) => (value === undefined || value === null ? {} : value),
  z.object({
    password: optionalNonEmptyString(),
    totp: optionalNonEmptyString(),
    recoveryCode: optionalNonEmptyString(),
    webauthnSessionId: optionalNonEmptyString(),
    webauthnResponse: z.record(z.string(), z.unknown()).optional(),
  })
);

// --- TOTP disable (DELETE /api/v1/users/me/totp) ---

export const totpDisableReqSchema = z.object({
  totp: requiredTrimmedString("TOTP code is required."),
});

const totpBeginDataSchema = z.object({
  uri: z.string(),
});

export const totpBeginSchema = detailsResponseSchema(totpBeginDataSchema);

// --- TOTP confirm (POST /api/v1/users/me/totp/confirm) ---

export const totpConfirmReqSchema = z.object({
  code: requiredTrimmedString("Code is required."),
});

// --- Multifactor verify at login (POST /api/v1/auth/multifactor/verify) ---

export const mfaVerifyReqSchema = z
  .object({
    totp: z.string().trim().optional(),
    recoveryCode: z.string().trim().optional(),
  })
  .superRefine((body, ctx) => {
    const hasTotp = (body.totp?.length ?? 0) > 0;
    const hasRecoveryCode = (body.recoveryCode?.length ?? 0) > 0;

    if (hasTotp && hasRecoveryCode) {
      ctx.addIssue({
        code: "custom",
        message: "Send only one proof.",
      });
      return;
    }

    if (!hasTotp && !hasRecoveryCode) {
      ctx.addIssue({
        code: "custom",
        message: "A proof is required.",
      });
    }
  });

// --- Recovery codes (POST /api/v1/users/me/codes) ---

const recoveryCodesDataSchema = z.object({
  recoveryCodes: z.array(z.string()),
});

export const recoveryCodeSchema = detailsResponseSchema(recoveryCodesDataSchema);

// --- WebAuthn finish (POST register/login finish) ---

export const webauthnFinishReqSchema = z
  .object({
    sessionId: requiredTrimmedString("Session id is required."),
    response: z.record(z.string(), z.unknown()).optional(),
    name: z.string().trim().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.response === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "WebAuthn response is required.",
        path: ["response"],
      });
    }
  });

const webauthnSessionDataSchema = z.object({
  sessionId: z.string().uuid(),
  options: z.record(z.string(), z.unknown()),
});

export const webauthnSessionSchema = detailsResponseSchema(webauthnSessionDataSchema);

const webauthnCredentialItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
});

export const webauthnCredSchema = paginatedListResponseSchema(webauthnCredentialItemSchema);

export const credentialIdParamsSchema = z.object({
  credentialId: z.string().uuid(),
});
