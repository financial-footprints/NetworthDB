import { requiredTrimmedString } from "@platform/fields";
import { dataEnvelopeSchema, nullableDataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

// --- Login (POST /api/v1/auth/login) ---

export const loginReqSchema = z.object({
  username: requiredTrimmedString("api.auth.login.invalid.username-required"),
  password: z.string().min(1, { message: "api.auth.login.invalid.password-required" }),
});

const sessionTokenDataSchema = z.object({
  session_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int(),
});

export const sessionTokenSchema = dataEnvelopeSchema(sessionTokenDataSchema);

const mfaChallengeDataSchema = z.object({
  status: z.enum(["multifactor_required", "multifactor_enrollment_required"]),
  multifactor_token: z.string(),
  expires_in: z.number().int(),
  methods: z.array(z.enum(["totp", "webauthn", "recovery"])),
});

export const mfaChallengeSchema = dataEnvelopeSchema(mfaChallengeDataSchema);

export const loginSchema = z.union([sessionTokenSchema, mfaChallengeSchema]);

// --- Refresh (POST /api/v1/auth/refresh) ---

export const refreshReqSchema = z.object({
  refresh_token: requiredTrimmedString("api.auth.refresh.invalid.token-required"),
});

// --- Logout and other empty responses ---

export const emptySchema = nullableDataEnvelopeSchema(z.null());
