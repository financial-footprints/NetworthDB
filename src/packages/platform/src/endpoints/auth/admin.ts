import { ROLES } from "@ndb/core";
import { z } from "zod";

const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

// --- List users (GET /api/v1/users) ---

export const adminUserListQuerySchema = z.object({
  "pagination.limit": z.coerce
    .number()
    .int()
    .min(0, { message: "api.auth.admin.users.invalid.pagination" })
    .max(100)
    .optional()
    .default(100),
  "pagination.offset": z.coerce
    .number()
    .int()
    .min(0, { message: "api.auth.admin.users.invalid.pagination" })
    .optional()
    .default(0),
  "filters.role": z.enum(ROLES).optional(),
  "filters.multifactor_enabled": booleanQueryParam.optional(),
  search: z.string().trim().optional(),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

// --- User by id (PATCH/DELETE /api/v1/users/:id) ---

export const uuidIdParamsSchema = z.object({
  id: z.string().uuid(),
});
