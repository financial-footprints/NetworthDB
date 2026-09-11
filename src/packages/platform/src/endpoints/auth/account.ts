import { ROLES } from "@ndb/core";
import { emptySchema, sessionTokenSchema } from "@platform/endpoints/auth/session";
import { vaultSlotDataSchema } from "@platform/endpoints/auth/vault";
import { optionalTrimmedString, requiredTrimmedString } from "@platform/fields";
import { dataEnvelopeSchema, paginatedDataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

export const roleSchema = z.enum(ROLES);

// --- Register user (POST /api/v1/users) ---

export const registerUserReqSchema = z.object({
  username: requiredTrimmedString("api.auth.login.invalid.username-required"),
  password: z.string().min(1, { message: "api.auth.login.invalid.password-required" }),
  role: roleSchema.optional(),
});

const userDataSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  multifactor_enabled: z.boolean(),
  created_at: z.string(),
});

export const userSchema = dataEnvelopeSchema(userDataSchema);

export const userListSchema = paginatedDataEnvelopeSchema(userDataSchema);

// --- Patch me (PATCH /api/v1/users/me) ---

export const patchMeReqSchema = z
  .object({
    username: optionalTrimmedString(),
    current_password: z.string().min(1).optional(),
    new_password: z.string().min(1).optional(),
    display_name: optionalTrimmedString(),
    recovery_email: z.union([z.string().trim().min(1), z.null()]).optional(),
  })
  .transform((body) => ({
    username: body.username,
    currentPassword: body.current_password,
    newPassword: body.new_password,
    displayName: body.display_name,
    recoveryEmail: body.recovery_email,
  }))
  .refine(
    (body) =>
      body.username !== undefined ||
      body.newPassword !== undefined ||
      body.displayName !== undefined ||
      body.recoveryEmail !== undefined,
    { message: "api.auth.account.patch.invalid.no-fields" }
  );

export const patchMeSchema = z.union([sessionTokenSchema, emptySchema]);

const meDetailsDataSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  multifactor_enabled: z.boolean(),
  multifactor_methods: z.array(z.string()),
  recovery_codes_enabled: z.boolean(),
  recovery_email_enabled: z.boolean(),
  recovery_email_set_at: z.string().nullable(),
  vault_initialized: z.boolean(),
  vault_slots: z.array(vaultSlotDataSchema),
  display_name: z.string().nullable(),
});

export const meDetailsSchema = dataEnvelopeSchema(meDetailsDataSchema);

// --- Patch admin user (PATCH /api/v1/users/:id) ---

export const patchAdminUserReqSchema = z
  .object({
    username: optionalTrimmedString(),
    role: roleSchema.optional(),
  })
  .refine((body) => body.username !== undefined || body.role !== undefined, {
    message: "api.auth.admin.users.patch.invalid.no-fields",
  });

// --- Message responses (password reset begin, recovery actions, etc.) ---

const messageDataSchema = z.object({
  message: z.string(),
});

export const messageSchema = dataEnvelopeSchema(messageDataSchema);
