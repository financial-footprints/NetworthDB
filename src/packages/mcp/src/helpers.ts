import type { z } from "zod";

export type ToolSchema = z.ZodObject<Record<string, z.ZodType>>;

export type McpToolDefinition<S extends ToolSchema = ToolSchema> = {
  name: string;
  description: string;
  schema: S;
  handler: (args: z.infer<S>) => Promise<unknown>;
};

export type CatalogAccess = "public" | "session";

export function toMcpJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
