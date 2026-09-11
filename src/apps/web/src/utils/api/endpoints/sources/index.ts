import { API } from "@ndb/platform";
import { get, put } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/endpoints/auth";
import type {
  EmailSource,
  SourcesResponse,
  SourcesUpdate,
  ThunderbirdSourceConfig,
} from "@web/utils/api/endpoints/sources/types";

let statusPromise: Promise<SourcesResponse> | null = null;

function loadSources(): Promise<SourcesResponse> {
  return withSessionToken((sessionToken) =>
    get<SourcesResponse>(API.sources, {
      sessionToken: sessionToken,
    }).then((response) => response.data)
  );
}

export function getSources(): Promise<SourcesResponse> {
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
    put<SourcesResponse>(API.sources, body, {
      sessionToken: sessionToken,
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
    use_ssl: true,
    has_password: false,
  };
}
