import { requireElevated } from "@mcp/auth/admin";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod, stripUndefined } from "@mcp/tools/helpers";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { ROLES } from "@ndb/core";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const ADMIN_TOOL_NAMES = [
  "users_admin_list",
  "users_admin_create",
  "users_admin_patch",
  "users_admin_delete",
] as const;

const usersAdminListSchema = z.object({
  limit: z.number().int().min(0).max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  role: z.enum(ROLES).optional(),
  multifactorEnabled: z.boolean().optional(),
  search: z.string().trim().optional(),
});

const usersAdminCreateSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(ROLES).optional(),
});

const usersAdminPatchSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
});

const usersAdminDeleteSchema = z.object({
  id: z.string().uuid(),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.admin.missing-catalog.${name}`);
  }
  return entry;
}

export function createAdminTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("users_admin_list"),
      schema: usersAdminListSchema,
      invoke: async (input) => {
        requireElevated(session);
        const path = appendQuery(API.users.list, {
          limit: input.limit !== undefined ? String(input.limit) : undefined,
          offset: input.offset !== undefined ? String(input.offset) : undefined,
          role: input.role,
          multifactorEnabled:
            input.multifactorEnabled !== undefined
              ? input.multifactorEnabled
                ? "true"
                : "false"
              : undefined,
          search: input.search,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("users_admin_create"),
      schema: usersAdminCreateSchema,
      invoke: async (input) => {
        requireElevated(session);
        return session.requestJson("POST", API.users.create, input);
      },
    }),
    bindMethod({
      catalog: catalogEntry("users_admin_patch"),
      schema: usersAdminPatchSchema,
      invoke: async (input) => {
        requireElevated(session);
        const { id, ...fields } = input;
        return session.requestJson(
          "PATCH",
          apiPath(API.users.patch, { userId: id }),
          stripUndefined(fields)
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("users_admin_delete"),
      schema: usersAdminDeleteSchema,
      invoke: async (input) => {
        requireElevated(session);
        return session.requestJson("DELETE", apiPath(API.users.delete, { userId: input.id }));
      },
    }),
  ];
}
