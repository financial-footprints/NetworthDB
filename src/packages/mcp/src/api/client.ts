import { parseApiError } from "@mcp/api/errors";
import { REQUEST_ID_HEADER } from "@ndb/platform";

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export type ApiClientOptions = {
  apiOrigin: string;
  fetchImpl?: FetchImpl;
};

export type RequestJsonOptions = {
  sessionToken?: string;
  body?: unknown;
};

export type RequestFormOptions = {
  sessionToken?: string;
};

export type RequestBytesResult = {
  buffer: Uint8Array;
  contentType: string;
  filename?: string;
};

function resolveUrl(baseUrl: string, path: string): string {
  if (path.includes("://")) {
    return path;
  }
  const resolvedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${resolvedPath}`;
}

function unwrapSuccessBody(payload: unknown): unknown {
  if (payload === null || typeof payload !== "object") {
    return payload;
  }
  const record = payload as Record<string, unknown>;
  if ("items" in record) {
    return record;
  }
  if ("data" in record && !("items" in record)) {
    return record.data;
  }
  return record;
}

function parseContentDispositionFilename(header: string | null): string | undefined {
  if (!header) {
    return undefined;
  }
  const match = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;\s]+)/i.exec(header);
  return match?.[1];
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchImpl;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.apiOrigin.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async get<T>(path: string, options?: RequestJsonOptions): Promise<T> {
    return this.requestJson<T>("GET", path, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestJsonOptions): Promise<T> {
    return this.requestJson<T>("POST", path, { ...options, body });
  }

  async patch<T>(path: string, body?: unknown, options?: RequestJsonOptions): Promise<T> {
    return this.requestJson<T>("PATCH", path, { ...options, body });
  }

  async put<T>(path: string, body?: unknown, options?: RequestJsonOptions): Promise<T> {
    return this.requestJson<T>("PUT", path, { ...options, body });
  }

  async delete<T>(path: string, options?: RequestJsonOptions): Promise<T> {
    return this.requestJson<T>("DELETE", path, options);
  }

  async requestJson<T>(method: string, path: string, options?: RequestJsonOptions): Promise<T> {
    const headers = new Headers();
    headers.set(REQUEST_ID_HEADER, crypto.randomUUID());

    if (options?.sessionToken) {
      headers.set("Authorization", `Bearer ${options.sessionToken}`);
    }

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const url = resolveUrl(this.baseUrl, path);
    const response = await this.fetchImpl(url, { method, headers, body });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    if (response.status === 204) {
      return null as T;
    }

    const payload = await response.json();
    return unwrapSuccessBody(payload) as T;
  }

  async requestForm<T>(path: string, form: FormData, options?: RequestFormOptions): Promise<T> {
    const headers = new Headers();
    headers.set(REQUEST_ID_HEADER, crypto.randomUUID());

    if (options?.sessionToken) {
      headers.set("Authorization", `Bearer ${options.sessionToken}`);
    }

    const url = resolveUrl(this.baseUrl, path);
    const response = await this.fetchImpl(url, { method: "POST", headers, body: form });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const payload = await response.json();
    return unwrapSuccessBody(payload) as T;
  }

  async requestBytes(path: string, options?: RequestFormOptions): Promise<RequestBytesResult> {
    const headers = new Headers();
    headers.set(REQUEST_ID_HEADER, crypto.randomUUID());

    if (options?.sessionToken) {
      headers.set("Authorization", `Bearer ${options.sessionToken}`);
    }

    const url = resolveUrl(this.baseUrl, path);
    const response = await this.fetchImpl(url, { method: "GET", headers });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("Content-Type") ?? "application/octet-stream";
    const filename = parseContentDispositionFilename(response.headers.get("Content-Disposition"));

    return { buffer, contentType, filename };
  }
}
