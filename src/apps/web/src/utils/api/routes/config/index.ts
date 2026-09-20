import { API, configSchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";

type PublicConfigResponse = {
  advancedSecurity: {
    disabled: boolean;
  };
};

let configPromise: Promise<PublicConfigResponse> | null = null;

function loadConfig(): Promise<PublicConfigResponse> {
  return apiRequest(API.config.get, { schema: configSchema }).then((response) => response.data);
}

export function fetchPublicConfig(): Promise<PublicConfigResponse> {
  if (!configPromise) {
    configPromise = loadConfig().catch((error: unknown) => {
      configPromise = null;
      throw error;
    });
  }
  return configPromise;
}
