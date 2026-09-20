import { formatMcpError } from "@mcp/error";
import type { McpToolDefinition } from "@mcp/helpers";
import { toMcpJson } from "@mcp/helpers";
import type { McpPromptDefinition } from "@mcp/prompts/types";
import type { McpResourceDefinition } from "@mcp/resources/helpers";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod";

function assertZodObject(schema: z.ZodType, label: string): z.ZodObject {
  if (schema instanceof z.ZodObject) {
    return schema;
  }
  throw new Error(`mcp.server.${label}.schema-must-be-object`);
}

function flattenParams(variables: Record<string, string | string[]>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    params[key] = Array.isArray(value) ? (value[0] ?? "") : value;
  }
  return params;
}

function resourceContents(uri: URL, mimeType: string, payload: unknown) {
  const text =
    mimeType === "text/markdown" && typeof payload === "string"
      ? payload
      : JSON.stringify(toMcpJson(payload), null, 2);

  return {
    contents: [
      {
        uri: uri.href,
        mimeType,
        text,
      },
    ],
  };
}

export function createMcpServer(input: {
  tools: McpToolDefinition[];
  resources?: McpResourceDefinition[];
  prompts?: McpPromptDefinition[];
}): McpServer {
  const resources = input.resources ?? [];
  const prompts = input.prompts ?? [];
  const capabilities: { tools: object; resources?: object; prompts?: object } = { tools: {} };
  if (resources.length > 0) {
    capabilities.resources = {};
  }
  if (prompts.length > 0) {
    capabilities.prompts = {};
  }

  const server = new McpServer({ name: "networthdb", version: "0.0.0" }, { capabilities });

  for (const tool of input.tools) {
    const inputSchema = assertZodObject(tool.schema, "tool");
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
      },
      async (args) => {
        try {
          const result = await tool.handler(args);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: formatMcpError(error),
              },
            ],
          };
        }
      }
    );
  }

  for (const resource of resources) {
    const metadata = {
      title: resource.title,
      description: resource.description,
      mimeType: resource.mimeType,
    };

    if (resource.uriTemplate) {
      const template = new ResourceTemplate(resource.uriTemplate, {
        list: undefined,
        ...(resource.complete ? { complete: resource.complete } : {}),
      });
      server.registerResource(resource.name, template, metadata, async (uri, variables) => {
        try {
          const payload = await resource.read(uri, flattenParams(variables));
          return resourceContents(uri, resource.mimeType, payload);
        } catch (error) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: resource.mimeType,
                text: formatMcpError(error),
              },
            ],
          };
        }
      });
      continue;
    }

    if (!resource.uri) {
      throw new Error(`mcp.server.resource.missing-uri.${resource.name}`);
    }

    server.registerResource(resource.name, resource.uri, metadata, async (uri) => {
      try {
        const payload = await resource.read(uri, {});
        return resourceContents(uri, resource.mimeType, payload);
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: resource.mimeType,
              text: formatMcpError(error),
            },
          ],
        };
      }
    });
  }

  for (const prompt of prompts) {
    const argsSchema = assertZodObject(prompt.schema, "prompt");
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema,
      },
      async (args) => {
        try {
          return await prompt.handler(args);
        } catch (error) {
          return {
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: formatMcpError(error),
                },
              },
            ],
          };
        }
      }
    );
  }

  return server;
}
