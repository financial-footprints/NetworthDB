import { ROLES } from "@core/domains/user/roles";
import {
  nullableSessionResponseSchema,
  sessionTokenSchema,
} from "@platform/http/endpoints/auth/session";
import { vaultSlotDataSchema } from "@platform/http/endpoints/auth/vault";
import { detailsResponseSchema, paginatedListResponseSchema } from "@platform/http/envelopes";
import { optionalTrimmedString, requiredTrimmedString } from "@platform/schema/fields";
import { z } from "zod";

export const roleSchema = z.enum(ROLES);

// --- Register user (POST /api/v1/users) ---

export const registerUserReqSchema = z.object({
  username: requiredTrimmedString("Username is required."),
  password: z.string().min(1, { message: "Password is required." }),
  role: roleSchema.optional(),
});

const userDataSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  multifactorEnabled: z.boolean(),
  createdAt: z.string(),
});

export const userSchema = detailsResponseSchema(userDataSchema);

export const userListSchema = paginatedListResponseSchema(userDataSchema);

// --- Patch me (PATCH /api/v1/users/me) ---

export const patchMeReqSchema = z
  .object({
    username: optionalTrimmedString(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(1).optional(),
    displayName: optionalTrimmedString(),
    clientSettings: z.record(z.string(), z.unknown()).nullable().optional(),
    recoveryEmail: z.union([z.string().trim().min(1), z.null()]).optional(),
  })
  .refine(
    (body) =>
      body.username !== undefined ||
      body.newPassword !== undefined ||
      body.displayName !== undefined ||
      body.clientSettings !== undefined ||
      body.recoveryEmail !== undefined,
    { message: "No fields to update." }
  );

export const patchMeSchema = z.union([sessionTokenSchema, nullableSessionResponseSchema]);

const meDetailsDataSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  multifactorEnabled: z.boolean(),
  multifactorMethods: z.array(z.string()),
  recoveryCodesEnabled: z.boolean(),
  recoveryEmailEnabled: z.boolean(),
  recoveryEmailSetAt: z.string().nullable(),
  vaultInitialized: z.boolean(),
  vaultSlots: z.array(vaultSlotDataSchema),
  displayName: z.string().nullable(),
  clientSettings: z.record(z.string(), z.unknown()).nullable(),
});

export const meDetailsSchema = detailsResponseSchema(meDetailsDataSchema);

// --- Patch admin user (PATCH /api/v1/users/:id) ---

export const patchAdminUserReqSchema = z
  .object({
    username: optionalTrimmedString(),
    role: roleSchema.optional(),
  })
  .refine((body) => body.username !== undefined || body.role !== undefined, {
    message: "No fields to update.",
  });

// --- Message responses (password reset begin, recovery actions, etc.) ---

const messageDataSchema = z.object({
  message: z.string(),
});

export const messageSchema = detailsResponseSchema(messageDataSchema);
