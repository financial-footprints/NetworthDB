import { ROLES } from "@core/domains/user/roles";
import { pageLimitSchema } from "@platform/http/envelopes";
import { z } from "zod";

const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

// --- List users (GET /api/v1/users) ---

export const adminUserListQuerySchema = z.object({
  limit: pageLimitSchema({ max: 100, defaultLimit: 100 }),
  offset: z.coerce.number().int().min(0).default(0),
  role: z.enum(ROLES).optional(),
  multifactorEnabled: booleanQueryParam.optional(),
  search: z.string().trim().optional(),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});
