import { optionalNonEmptyString, requiredTrimmedString } from "@platform/fields";
import { dataEnvelopeSchema, paginatedDataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

// --- Multifactor proof (POST /api/v1/users/me/totp/begin, /codes, /webauthn/register/begin) ---

export const mfaProofReqSchema = z.preprocess(
  (value) => (value === undefined || value === null ? {} : value),
  z
    .object({
      password: optionalNonEmptyString(),
      totp: optionalNonEmptyString(),
      recovery_code: optionalNonEmptyString(),
      webauthn_session_id: optionalNonEmptyString(),
      webauthn_response: z.record(z.string(), z.unknown()).optional(),
    })
    .transform((body) => ({
      password: body.password,
      totp: body.totp,
      recoveryCode: body.recovery_code,
      webauthnSessionId: body.webauthn_session_id,
      webauthnResponse: body.webauthn_response,
    }))
);

// --- TOTP disable (DELETE /api/v1/users/me/totp) ---

export const totpDisableReqSchema = z.object({
  totp: requiredTrimmedString("api.auth.multifactor.totp.invalid.required"),
});

const totpBeginDataSchema = z.object({
  uri: z.string(),
});

export const totpBeginSchema = dataEnvelopeSchema(totpBeginDataSchema);

// --- TOTP confirm (POST /api/v1/users/me/totp/confirm) ---

export const totpConfirmReqSchema = z.object({
  code: requiredTrimmedString("api.auth.multifactor.verify.invalid.code-required"),
});

// --- Multifactor verify at login (POST /api/v1/auth/multifactor/verify) ---

export const mfaVerifyReqSchema = z
  .object({
    totp: z.string().trim().optional(),
    recovery_code: z.string().trim().optional(),
  })
  .superRefine((body, ctx) => {
    const hasTotp = (body.totp?.length ?? 0) > 0;
    const hasRecoveryCode = (body.recovery_code?.length ?? 0) > 0;

    if (hasTotp && hasRecoveryCode) {
      ctx.addIssue({
        code: "custom",
        message: "api.auth.multifactor.verify.invalid.multiple-proofs",
      });
      return;
    }

    if (!hasTotp && !hasRecoveryCode) {
      ctx.addIssue({
        code: "custom",
        message: "api.auth.multifactor.verify.invalid.proof-required",
      });
    }
  })
  .transform((body) => ({
    totp: body.totp && body.totp.length > 0 ? body.totp : undefined,
    recoveryCode:
      body.recovery_code && body.recovery_code.length > 0 ? body.recovery_code : undefined,
  }));

// --- Recovery codes (POST /api/v1/users/me/codes) ---

const recoveryCodesDataSchema = z.object({
  recovery_codes: z.array(z.string()),
});

export const recoveryCodeSchema = dataEnvelopeSchema(recoveryCodesDataSchema);

// --- WebAuthn finish (POST register/login finish) ---

export const webauthnFinishReqSchema = z
  .object({
    session_id: requiredTrimmedString("api.auth.webauthn.finish.invalid.session-id-required"),
    response: z.record(z.string(), z.unknown()).optional(),
    name: z.string().trim().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.response === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "api.auth.webauthn.finish.invalid.response-required",
        path: ["response"],
      });
    }
  })
  .transform((body) => ({
    sessionId: body.session_id,
    response: body.response ?? {},
    name: body.name && body.name.length > 0 ? body.name : undefined,
  }));

const webauthnSessionDataSchema = z.object({
  session_id: z.string().uuid(),
  options: z.record(z.string(), z.unknown()),
});

export const webauthnSessionSchema = dataEnvelopeSchema(webauthnSessionDataSchema);

const webauthnCredentialItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
});

export const webauthnCredSchema = paginatedDataEnvelopeSchema(webauthnCredentialItemSchema);
