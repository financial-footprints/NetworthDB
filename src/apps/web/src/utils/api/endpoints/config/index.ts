import { API } from "@ndb/platform";
import { get } from "@web/utils/api/client";

export type PublicConfigResponse = {
  advanced_security: {
    disabled: boolean;
  };
};

let configPromise: Promise<PublicConfigResponse> | null = null;
let configCache: PublicConfigResponse | null = null;

function loadConfig(): Promise<PublicConfigResponse> {
  return get<PublicConfigResponse>(API.config.get).then((response) => response.data);
}

export function readPublicConfig(): Promise<PublicConfigResponse> {
  if (!configPromise) {
    configPromise = loadConfig()
      .then((config) => {
        configCache = config;
        return config;
      })
      .catch((error: unknown) => {
        configPromise = null;
        configCache = null;
        throw error;
      });
  }
  return configPromise;
}

export function isAdvancedSecurityDisabled(): boolean {
  return configCache?.advanced_security.disabled ?? false;
}

export function isSensitiveBackupsEnabled(): boolean {
  return isAdvancedSecurityDisabled();
}
