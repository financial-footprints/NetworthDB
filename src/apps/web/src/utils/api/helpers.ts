import { apiErrorResponseSchema } from "@ndb/platform";
import type { NotificationVariant } from "@web/context/Notifications/NotificationContext";
import { log } from "@web/logging";
import {
  ApiError,
  type ApiSoftError,
  type ApiSuccess,
  type ValidationDetails,
} from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { use, useEffect, useMemo, useState } from "react";

/** Resolve a fetch URL from base + path (supports absolute and same-origin bases). */
export function toRequestUrl(base: string, path: string): URL {
  const href = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  return href.includes("://") ? new URL(href) : new URL(href, globalThis.location.origin);
}

export type RequestAuthHeadersOptions = {
  sessionToken?: string;
};

export function applyRequestAuthHeaders(
  headers: Headers,
  options?: RequestAuthHeadersOptions
): void {
  if (options?.sessionToken) {
    headers.set("Authorization", `Bearer ${options.sessionToken}`);
  }
}

/** Shared bits for JSON fetch clients (API + auth). */
export function jsonRequestInit(
  method: string,
  options?: {
    body?: unknown;
    signal?: AbortSignal;
  } & RequestAuthHeadersOptions
): RequestInit {
  const headers = new Headers();
  let body: string | undefined;

  applyRequestAuthHeaders(headers, options);
  headers.set("X-Request-Id", crypto.randomUUID());

  if (options?.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  return {
    method,
    headers,
    body,
    signal: options?.signal,
  };
}

function buildValidationDetails(
  message: string,
  field?: string,
  details?: Record<string, unknown>
): ValidationDetails[] | undefined {
  const items: ValidationDetails[] = [];

  if (field) {
    items.push({ loc: field.split("."), msg: message });
  }

  if (details) {
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === "string") {
        items.push({ loc: key.split("."), msg: value });
      }
    }
  }

  return items.length > 0 ? items : undefined;
}

async function parseDetailsError(response: Response): Promise<ApiError> {
  let message = response.statusText;
  let code: string | undefined;
  let field: string | undefined;
  let details: Record<string, unknown> | undefined;

  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const parsed = apiErrorResponseSchema.safeParse(payload);
    if (parsed.success) {
      message = parsed.data.error;
      code = parsed.data.code;
      field = parsed.data.field;
      details = parsed.data.details;
    } else if (typeof payload.details === "string") {
      message = payload.details;
    }
  } catch {
    // keep statusText
  }

  const resolvedMessage = message || `Request failed with status ${response.status}`;
  const validationDetails = buildValidationDetails(resolvedMessage, field, details);

  return new ApiError(response.status, resolvedMessage, code, field, validationDetails);
}

function parseSoftErrors(value: unknown): ApiSoftError[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is ApiSoftError => typeof item === "object" && item !== null
  ) as ApiSoftError[];
}

/** Parse a successful `{ data, errors }` envelope or throw ApiError on failure. */
export async function requestJson<T>(
  url: URL | string,
  init?: RequestInit
): Promise<ApiSuccess<T>> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const requestUrl = typeof url === "string" ? new URL(url, globalThis.location.origin) : url;
    const pathname = requestUrl.pathname;
    const skipWarn =
      response.status === 409 || (response.status === 401 && /\/login(?:\/|$)/.test(pathname));
    if (!skipWarn) {
      const headerId = response.headers.get("X-Request-Id");
      const sentId = init?.headers instanceof Headers ? init.headers.get("X-Request-Id") : null;
      log("warn", "@ndb/web.api.request.failed", {
        status: response.status,
        path: pathname,
        request_id: headerId ?? sentId ?? undefined,
      });
    }
    throw await parseDetailsError(response);
  }

  if (response.status === 204) {
    return { data: null as T, errors: [] };
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: unknown;
  };

  return {
    data: (payload.data ?? null) as T,
    errors: parseSoftErrors(payload.errors),
  };
}

type VersionedResource<T> = {
  read: () => Promise<T>;
  setCache: (data: T) => void;
  invalidate: () => void;
  useResource: () => T;
};

/** Suspense-friendly promise cache with versioned invalidation listeners. */
export function createVersionedResource<T>(load: () => Promise<T>): VersionedResource<T> {
  let cache: Promise<T> | null = null;
  let version = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    version += 1;
    for (const listener of listeners) {
      listener();
    }
  }

  function read(): Promise<T> {
    if (!cache) {
      cache = load();
    }
    return cache;
  }

  function setCache(data: T): void {
    cache = Promise.resolve(data);
  }

  function invalidate(): void {
    cache = null;
    notify();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function useResource(): T {
    const [currentVersion, setCurrentVersion] = useState(() => version);

    useEffect(
      () =>
        subscribe(() => {
          setCurrentVersion(version);
        }),
      []
    );

    const promise = useMemo(() => {
      // `currentVersion` is required so invalidate triggers a fresh Suspense promise.
      void currentVersion;
      return read();
    }, [currentVersion]);

    return use(promise);
  }

  return {
    read,
    setCache,
    invalidate,
    useResource,
  };
}

type PushNotification = (message: string, variant?: NotificationVariant) => void;

/** Enqueue a background job: success toast + invalidate, or 409 warning. */
export async function runEnqueueJob(options: {
  action: () => Promise<unknown>;
  pushNotification: PushNotification;
  successMessage: string;
  conflictMessage: string;
  failureFallback: string;
}): Promise<void> {
  try {
    await options.action();
    options.pushNotification(options.successMessage);
    const { invalidateJobs } = await import("@web/utils/api/endpoints/jobs");
    invalidateJobs();
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      options.pushNotification(options.conflictMessage, "warning");
    } else {
      options.pushNotification(errorMessage(error, options.failureFallback), "error");
    }
  }
}
