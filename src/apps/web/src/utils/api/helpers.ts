import type { NotificationVariant } from "@web/contexts/Notifications/Context";
import { withSessionToken } from "@web/utils/api/routes/auth";
import { invalidateJobs } from "@web/utils/api/routes/jobs";
import { ApiError } from "@web/utils/api/types";
import { readDEK } from "@web/utils/crypto/session";
import { errorMessage } from "@web/utils/errors";
import { use, useEffect, useMemo, useState } from "react";

export const VAULT_LOCKED_MESSAGE = "Vault is locked";

export async function withVaultDek<T>(
  fn: (sessionToken: string, dek: CryptoKey) => Promise<T>
): Promise<T> {
  return withSessionToken(async (sessionToken) => {
    const dek = await readDEK();
    if (!dek) {
      throw new Error(VAULT_LOCKED_MESSAGE);
    }
    return fn(sessionToken, dek);
  });
}

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
export async function runEnqueueJob<T>(options: {
  action: () => Promise<T>;
  pushNotification: PushNotification;
  successMessage: string;
  conflictMessage: string;
  failureFallback: string;
}): Promise<T | undefined> {
  try {
    const result = await options.action();
    options.pushNotification(options.successMessage);
    invalidateJobs();
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      options.pushNotification(options.conflictMessage, "warning");
    } else {
      options.pushNotification(errorMessage(error, options.failureFallback), "error");
    }
    return undefined;
  }
}
