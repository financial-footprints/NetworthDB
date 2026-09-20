import type { McpToolDefinition, ToolSchema } from "@mcp/helpers";
import { toMcpJson } from "@mcp/helpers";
import { formatToolDescription } from "@mcp/tools/schema";
import type { ServiceCatalogEntry } from "@mcp/tools/schema/inventory";
import type { z } from "zod";

export function stripUndefined<T extends Record<string, unknown>>(body: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export function appendQuery(path: string, query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function bindMethod<S extends ToolSchema>(options: {
  catalog: ServiceCatalogEntry;
  schema: S;
  invoke: (args: z.infer<S>) => Promise<unknown>;
}): McpToolDefinition<S> {
  return {
    name: options.catalog.name,
    description: formatToolDescription(options.catalog),
    schema: options.schema,
    handler: async (args) => {
      const result = await options.invoke(args);
      return toMcpJson(result);
    },
  };
}
