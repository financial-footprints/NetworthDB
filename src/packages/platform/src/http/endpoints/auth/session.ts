import { detailsResponseSchema, nullableDetailsResponseSchema } from "@platform/http/envelopes";
import { requiredTrimmedString } from "@platform/schema/fields";
import { z } from "zod";

// --- Login (POST /api/v1/auth/login) ---

export const loginReqSchema = z.object({
  username: requiredTrimmedString("Username is required."),
  password: z.string().min(1, { message: "Password is required." }),
});

const sessionTokenDataSchema = z.object({
  sessionToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

export const sessionTokenSchema = detailsResponseSchema(sessionTokenDataSchema);

const mfaChallengeDataSchema = z.object({
  status: z.enum(["multifactor_required", "multifactor_enrollment_required"]),
  multifactorToken: z.string(),
  expiresIn: z.number().int(),
  methods: z.array(z.enum(["totp", "webauthn", "recovery"])),
});

export const mfaChallengeSchema = detailsResponseSchema(mfaChallengeDataSchema);

export const loginSchema = z.union([sessionTokenSchema, mfaChallengeSchema]);

// --- Refresh (POST /api/v1/auth/refresh) ---

export const refreshReqSchema = z.object({
  refreshToken: requiredTrimmedString("Refresh token is required."),
});

// --- Patch me nullable token response ---

export const nullableSessionResponseSchema = nullableDetailsResponseSchema(z.null());
