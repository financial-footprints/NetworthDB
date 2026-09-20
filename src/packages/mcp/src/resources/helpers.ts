export type ResourceCompleteCallback = (
  value: string,
  context?: { arguments?: Record<string, string> }
) => Promise<string[]>;

export type McpResourceDefinition = {
  name: string;
  uri?: string;
  uriTemplate?: string;
  title: string;
  description: string;
  mimeType: "application/json" | "text/markdown";
  complete?: Record<string, ResourceCompleteCallback>;
  read: (uri: URL, params: Record<string, string>) => Promise<unknown>;
};
