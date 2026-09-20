import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { assertDisplayNameWritable } from "@mcp/tools/e2ee";
import { bindMethod, stripUndefined } from "@mcp/tools/helpers";
import { emptyArgsSchema } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API } from "@ndb/platform";
import { z } from "zod";

export const PROFILE_TOOL_NAMES = ["profile_get", "profile_patch"] as const;

const profilePatchSchema = z
  .object({
    username: z.string().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(1).optional(),
    displayName: z.string().optional(),
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
    { message: "mcp.profile.patch.no-fields" }
  );

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.profile.missing-catalog.${name}`);
  }
  return entry;
}

export function createProfileTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("profile_get"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return session.getJson(API.users.me.get);
      },
    }),
    bindMethod({
      catalog: catalogEntry("profile_patch"),
      schema: profilePatchSchema,
      invoke: async (input) => {
        requireSession(session);
        if (input.displayName !== undefined) {
          await assertDisplayNameWritable(session, input.displayName);
        }
        return session.requestJson("PATCH", API.users.me.patch, stripUndefined({ ...input }));
      },
    }),
  ];
}
