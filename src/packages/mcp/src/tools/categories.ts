import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod } from "@mcp/tools/helpers";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const CATEGORY_TOOL_NAMES = [
  "categories_list",
  "categories_create",
  "categories_patch",
  "categories_delete",
] as const;

const categoriesListSchema = z.object({
  q: z.string().optional(),
  parentId: z.string().uuid().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

const categoriesCreateSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable(),
});

const categoriesPatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

const categoriesDeleteSchema = z.object({
  id: z.string().uuid(),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.categories.missing-catalog.${name}`);
  }
  return entry;
}

export function createCategoryTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("categories_list"),
      schema: categoriesListSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(API.categories.list, {
          q: input.q,
          parentId: input.parentId,
          limit: input.limit !== undefined ? String(input.limit) : undefined,
          offset: input.offset !== undefined ? String(input.offset) : undefined,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("categories_create"),
      schema: categoriesCreateSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("POST", API.categories.create, input);
      },
    }),
    bindMethod({
      catalog: catalogEntry("categories_patch"),
      schema: categoriesPatchSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, name } = input;
        return session.requestJson("PATCH", apiPath(API.categories.patch, { categoryId: id }), {
          name,
        });
      },
    }),
    bindMethod({
      catalog: catalogEntry("categories_delete"),
      schema: categoriesDeleteSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson(
          "DELETE",
          apiPath(API.categories.delete, { categoryId: input.id })
        );
      },
    }),
  ];
}
