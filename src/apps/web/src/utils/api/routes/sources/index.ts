import { API, type putSourcesReqSchema, sourcesSchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type {
  EmailSource,
  SourcesResponse,
  SourcesUpdate,
  ThunderbirdSourceConfig,
} from "@web/utils/api/routes/sources/types";
import type { z } from "zod";

let statusPromise: Promise<SourcesResponse> | null = null;

function toPutSourcesBody(body: SourcesUpdate): z.infer<typeof putSourcesReqSchema> {
  return {
    sources: body.sources.map((source) => {
      if (source.type === "email") {
        return {
          id: source.id,
          type: "email",
          label: source.label,
          host: source.host,
          port: source.port,
          username: source.username,
          password: source.password,
          folder: source.folder,
          useSsl: source.use_ssl,
        };
      }
      return source;
    }),
  };
}

function loadSources(): Promise<SourcesResponse> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.sources.get, {
      sessionToken,
      schema: sourcesSchema,
    }).then((response) => response.data)
  );
}

export function fetchSources(): Promise<SourcesResponse> {
  if (!statusPromise) {
    statusPromise = loadSources().catch((error: unknown) => {
      statusPromise = null;
      throw error;
    });
  }
  return statusPromise;
}

export function updateSources(body: SourcesUpdate): Promise<SourcesResponse> {
  statusPromise = null;
  return withSessionToken((sessionToken) =>
    apiRequest(API.sources.put, {
      method: "PUT",
      sessionToken,
      body: toPutSourcesBody(body),
      schema: sourcesSchema,
    }).then((response) => response.data)
  );
}

export function emptyThunderbirdSource(id: string): ThunderbirdSourceConfig {
  return {
    id,
    label: "",
    type: "thunderbird",
    profile: "",
  };
}

export function emptyEmailSource(id: string): EmailSource {
  return {
    id,
    label: "",
    type: "email",
    host: "",
    port: 993,
    username: "",
    folder: "INBOX",
    useSsl: true,
    hasPassword: false,
  };
}
