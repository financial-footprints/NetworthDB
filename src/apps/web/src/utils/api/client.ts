import { apiErrorResponseSchema, REQUEST_ID_HEADER } from "@ndb/platform";
import { log } from "@web/logging";
import { applyRequestAuthHeaders, toRequestUrl } from "@web/utils/api/helpers";
import { ApiError } from "@web/utils/api/types";

export function apiOrigin(): string {
  return (import.meta.env.PUBLIC_API_ORIGIN ?? "").trim().replace(/\/$/, "");
}

type ResponseSchema<T> = {
  parse: (data: unknown) => T;
};

type QueryParamValue = string | number | boolean;

export type ApiRequestOptions<T = unknown> = {
  method?: string;
  body?: unknown;
  schema?: ResponseSchema<T>;
  sessionToken?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  params?: Record<string, QueryParamValue | undefined | null>;
};

function buildQueryString(
  params?: Record<string, QueryParamValue | undefined | null> | null
): string {
  if (!params) {
    return "";
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const base = apiOrigin();
  const url = toRequestUrl(base, path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

function resolveResponseRayId(res: Response): string {
  return res.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}

async function readResponseBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

async function readHttpError(res: Response): Promise<ApiError> {
  const body = await readResponseBody(res);
  const parsed = apiErrorResponseSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(
      res.status,
      parsed.data.error,
      parsed.data.code,
      parsed.data.field,
      undefined
    );
  }
  const message =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { details?: unknown }).details === "string"
      ? (body as { details: string }).details
      : res.statusText || `Request failed with status ${res.status}`;
  return new ApiError(res.status, message);
}

function parseResponseData<T>(data: unknown, schema: ResponseSchema<T> | undefined): T {
  if (!schema) {
    return data as T;
  }
  return schema.parse(data) as T;
}

function buildApiRequestInit<T>(
  path: string,
  options: ApiRequestOptions<T>
): { url: string; init: RequestInit } {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const method = options.method ?? "GET";
  const base = apiOrigin();
  const url = `${toRequestUrl(base, path)}${buildQueryString(options.params)}`;

  const headers = new Headers();
  applyRequestAuthHeaders(headers, options);
  headers.set(REQUEST_ID_HEADER, crypto.randomUUID());

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }
  }

  return {
    url,
    init: {
      method,
      headers,
      body,
      signal: options.signal ?? AbortSignal.timeout(timeoutMs),
    },
  };
}

async function throwIfApiFailed(res: Response, url: string): Promise<void> {
  if (res.ok) {
    return;
  }
  const pathname = new URL(url).pathname;
  const skipWarn = res.status === 409 || (res.status === 401 && /\/login(?:\/|$)/.test(pathname));
  if (!skipWarn) {
    log("warn", "@ndb/web.api.request.failed", {
      status: res.status,
      path: pathname,
      request_id: resolveResponseRayId(res),
    });
  }
  throw await readHttpError(res);
}

async function readApiResponseBody<T>(res: Response, schema?: ResponseSchema<T>): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const data: unknown = await res.json();
  return parseResponseData(data, schema);
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions<T> = {}
): Promise<T> {
  const { url, init } = buildApiRequestInit(path, options);

  try {
    const res = await fetch(url, init);
    await throwIfApiFailed(res, url);
    return await readApiResponseBody(res, options.schema);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, "Unable to reach the server");
  }
}
