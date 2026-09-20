import type { McpPromptMessage } from "@mcp/prompts/types";

export function promptUserMessage(text: string): { messages: McpPromptMessage[] } {
  return {
    messages: [
      {
        role: "user",
        content: { type: "text", text },
      },
    ],
  };
}
