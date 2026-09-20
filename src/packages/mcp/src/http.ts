import type { FetchImpl } from "@mcp/api/client";
import { McpApiError } from "@mcp/api/errors";
import { assembleMcpCatalog } from "@mcp/assemble";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { createMcpServer } from "@mcp/server";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { ReadonlySqlExecutor } from "@ndb/database/readonly";

const WWW_AUTHENTICATE = 'Bearer realm="networthdb"';

export type CreateMcpHttpHandlerOptions = {
  apiOrigin: string;
  sql?: ReadonlySqlExecutor;
  fetchImpl?: FetchImpl;
};

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": WWW_AUTHENTICATE,
    },
  });
}

function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

async function readParsedBody(request: Request): Promise<unknown> {
  if (["GET", "HEAD", "DELETE"].includes(request.method)) {
    return undefined;
  }
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function isAuthFailure(error: unknown): boolean {
  if (error instanceof McpAuthError) {
    return true;
  }
  return error instanceof McpApiError && error.status === 401;
}

export function createMcpHttpHandler(options: CreateMcpHttpHandlerOptions) {
  const { apiOrigin, sql, fetchImpl } = options;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ status: "ok" });
    }

    if (url.pathname === "/mcp" && request.method === "OPTIONS") {
      return corsPreflightResponse();
    }

    if (url.pathname !== "/mcp") {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const bearer = parseBearerToken(request.headers.get("Authorization"));
    if (!bearer) {
      return unauthorizedResponse();
    }

    const session = new SessionStore({ apiOrigin, fetchImpl });
    try {
      await session.authenticateWithAccessToken(bearer);
    } catch (error) {
      if (isAuthFailure(error)) {
        return unauthorizedResponse();
      }
      throw error;
    }

    const catalog = assembleMcpCatalog({ session, sql });
    const mcpHandler = createMcpHandler(() => createMcpServer(catalog));
    const parsedBody = await readParsedBody(request);

    const response = await mcpHandler.fetch(request, {
      authInfo: { token: bearer, clientId: "networthdb", scopes: [] },
      parsedBody,
    });

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
