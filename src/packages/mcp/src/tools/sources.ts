import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { bindMethod } from "@mcp/tools/helpers";
import { emptyArgsSchema } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API } from "@ndb/platform";
import { z } from "zod";

export const SOURCE_TOOL_NAMES = ["sources_get", "sources_put"] as const;

const thunderbirdSourceSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("thunderbird"),
    label: z.string().optional(),
    profile: z.string().min(1),
  })
  .strict();

const emailSourceSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("email"),
    label: z.string().optional(),
    host: z.string().min(1),
    port: z.number().int().optional(),
    username: z.string().min(1),
    password: z.string().optional(),
    folder: z.string().optional(),
    useSsl: z.boolean().optional(),
  })
  .strict();

const sourceWriteSchema = z.discriminatedUnion("type", [
  thunderbirdSourceSchema,
  emailSourceSchema,
]);

const sourcesPutSchema = z.object({
  sources: z.array(sourceWriteSchema).default([]),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.sources.missing-catalog.${name}`);
  }
  return entry;
}

export function createSourceTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("sources_get"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return session.getJson(API.sources.get);
      },
    }),
    bindMethod({
      catalog: catalogEntry("sources_put"),
      schema: sourcesPutSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("PUT", API.sources.put, { sources: input.sources });
      },
    }),
  ];
}
