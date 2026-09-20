import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod } from "@mcp/tools/helpers";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const TAG_TOOL_NAMES = ["tags_list", "tags_create", "tags_patch", "tags_delete"] as const;

const tagsListSchema = z.object({
  q: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

const tagsCreateSchema = z.object({
  name: z.string().min(1),
});

const tagsPatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

const tagsDeleteSchema = z.object({
  id: z.string().uuid(),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.tags.missing-catalog.${name}`);
  }
  return entry;
}

export function createTagTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("tags_list"),
      schema: tagsListSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(API.tags.list, {
          q: input.q,
          limit: input.limit !== undefined ? String(input.limit) : undefined,
          offset: input.offset !== undefined ? String(input.offset) : undefined,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("tags_create"),
      schema: tagsCreateSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("POST", API.tags.create, input);
      },
    }),
    bindMethod({
      catalog: catalogEntry("tags_patch"),
      schema: tagsPatchSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, name } = input;
        return session.requestJson("PATCH", apiPath(API.tags.patch, { tagId: id }), { name });
      },
    }),
    bindMethod({
      catalog: catalogEntry("tags_delete"),
      schema: tagsDeleteSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("DELETE", apiPath(API.tags.delete, { tagId: input.id }));
      },
    }),
  ];
}
