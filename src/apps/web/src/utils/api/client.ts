import { apiOrigin } from "@web/utils/api/baseUrl";
import {
  applyRequestAuthHeaders,
  jsonRequestInit,
  type RequestAuthHeadersOptions,
  requestJson,
  toRequestUrl,
} from "@web/utils/api/helpers";
import type { ApiSuccess } from "@web/utils/api/types";

type RequestOptions = RequestAuthHeadersOptions & {
  params?: Record<string, string | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

type ApiGetOptions = Omit<RequestOptions, "body">;
type ApiMutationOptions = Omit<RequestOptions, "body">;
type ApiDeleteOptions = Omit<RequestOptions, "params" | "signal">;

function createUrl(path: string, params?: Record<string, string | undefined>): URL {
  const url = toRequestUrl(apiOrigin(), path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url;
}

async function request<T>(
  method: string,
  path: string,
  options?: RequestOptions
): Promise<ApiSuccess<T>> {
  return requestJson<T>(
    createUrl(path, options?.params),
    jsonRequestInit(method, {
      body: options?.body,
      sessionToken: options?.sessionToken,
      signal: options?.signal,
    })
  );
}

export function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  return createUrl(path, params).toString();
}

export function get<T>(path: string, options?: ApiGetOptions): Promise<ApiSuccess<T>> {
  return request("GET", path, options);
}

export function post<T>(
  path: string,
  body?: unknown,
  options?: ApiMutationOptions
): Promise<ApiSuccess<T>> {
  if (body instanceof FormData) {
    const headers = new Headers();
    applyRequestAuthHeaders(headers, options);
    headers.set("X-Request-Id", crypto.randomUUID());
    return requestJson<T>(buildUrl(path), {
      method: "POST",
      headers,
      body,
      signal: options?.signal,
    });
  }
  return request("POST", path, { body, ...options });
}

export function put<T>(
  path: string,
  body?: unknown,
  options?: ApiMutationOptions
): Promise<ApiSuccess<T>> {
  return request("PUT", path, { body, ...options });
}

export function patch<T>(
  path: string,
  body?: unknown,
  options?: ApiMutationOptions
): Promise<ApiSuccess<T>> {
  return request("PATCH", path, { body, ...options });
}

export function del<T>(path: string, options?: ApiDeleteOptions): Promise<ApiSuccess<T>> {
  return request("DELETE", path, options);
}
