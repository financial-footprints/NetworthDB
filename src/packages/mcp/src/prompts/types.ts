import type { z } from "zod";

type PromptSchema = z.ZodObject<Record<string, z.ZodType>>;

export type McpPromptMessage = {
  role: "user";
  content: { type: "text"; text: string };
};

export type McpPromptDefinition<S extends PromptSchema = PromptSchema> = {
  name: string;
  title: string;
  description: string;
  schema: S;
  handler: (args: z.infer<S>) => Promise<{ messages: McpPromptMessage[] }>;
};
