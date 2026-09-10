import { REQUEST_ID_HEADER } from "@ndb/platform";
import { cors } from "hono/cors";

interface CorsOptions {
  /** Allow requests from local HTTP loopback hosts. */
  allowLocalhost?: boolean;
  /** Extra exact origins to allow. */
  allowedOrigins?: string[];
  /** Extra request headers to allow (merged with Authorization, Content-Type, and ray id). */
  allowHeaders?: string[];
}

const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1"]);

function isAllowedLocalOrigin(originUrl: URL): boolean {
  return originUrl.protocol === "http:" && LOCAL_HTTP_HOSTS.has(originUrl.hostname);
}

function resolveCorsOrigin(
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

const DEFAULT_ALLOW_HEADERS = ["Authorization", "Content-Type", REQUEST_ID_HEADER];

export function corsMiddleware(options: CorsOptions = {}) {
  const { allowLocalhost = false, allowedOrigins = [], allowHeaders = [] } = options;

  return cors({
    origin: (origin) => resolveCorsOrigin(origin, allowLocalhost, allowedOrigins),
    allowHeaders: [...new Set([...DEFAULT_ALLOW_HEADERS, ...allowHeaders])],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: [REQUEST_ID_HEADER],
  });
}
