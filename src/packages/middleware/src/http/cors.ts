import { REQUEST_ID_HEADER } from "@ndb/platform";
import { cors as honoCors } from "hono/cors";

export type CorsOptions = {
  allowLocalhost?: boolean;
  allowedOrigins?: string[];
  allowHeaders?: string[];
};

const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DEFAULT_ALLOW_HEADERS = ["Authorization", "Content-Type", REQUEST_ID_HEADER];

function isAllowedLocalOrigin(originUrl: URL): boolean {
  return originUrl.protocol === "http:" && LOCAL_HTTP_HOSTS.has(originUrl.hostname);
}

function resolveOrigin(
  origin: string | undefined,
  allowLocalhost: boolean,
  allowedOrigins: string[]
): string | null | undefined {
  if (!origin) {
    return origin;
  }

  try {
    const originUrl = new URL(origin);
    if (allowedOrigins.includes(origin) || (allowLocalhost && isAllowedLocalOrigin(originUrl))) {
      return origin;
    }
  } catch {
    // invalid URL
  }

  return null;
}

export function cors(options: CorsOptions = {}) {
  const { allowLocalhost = false, allowedOrigins = [], allowHeaders = [] } = options;

  return honoCors({
    origin: (origin) => resolveOrigin(origin, allowLocalhost, allowedOrigins),
    allowHeaders: [...new Set([...DEFAULT_ALLOW_HEADERS, ...allowHeaders])],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: [REQUEST_ID_HEADER],
  });
}
