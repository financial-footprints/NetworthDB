import { apiErrorResponseSchema } from "@ndb/platform";

export class McpApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;

  constructor(status: number, message: string, code?: string, field?: string) {
    super(message);
    this.name = "McpApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export async function parseApiError(response: Response): Promise<McpApiError> {
  let message = response.statusText || `mcp.api.http.${response.status}`;
  let code: string | undefined;
  let field: string | undefined;

  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const parsed = apiErrorResponseSchema.safeParse(payload);
    if (parsed.success) {
      message = parsed.data.error;
      code = parsed.data.code;
      field = parsed.data.field;
    } else if (typeof payload.error === "string") {
      message = payload.error;
    }
  } catch {
    // keep statusText
  }

  if (response.status === 401) {
    message = message || "mcp.api.http.unauthorized";
  }

  return new McpApiError(response.status, message, code, field);
}
