import type { BootstrapEnv } from "@bootstrap/config/env";
import type { AppEnv, WebAuthnRpConfig } from "@ndb/core";

export type WebAuthnConfig = {
  rp: WebAuthnRpConfig | null;
  ttl: {
    session: number;
  };
};

export function loadWebAuthnConfig(
  env: BootstrapEnv,
  environment: AppEnv,
  ttl: number
): WebAuthnConfig {
  const rpId = env.WEBAUTHN_RP_ID;
  const rpOrigins = env.WEBAUTHN_RP_ORIGINS;
  const rpDisplayName = env.WEBAUTHN_RP_DISPLAY_NAME ?? "NetworthDB";

  if (!rpId || rpOrigins.length === 0) {
    if (environment === "production") {
      throw new Error("bootstrap.config.env.required.not-found.WEBAUTHN_RP_ID");
    }

    return { rp: null, ttl: { session: ttl } };
  }

  return {
    rp: {
      rpDisplayName,
      rpId,
      rpOrigins,
    },
    ttl: { session: ttl },
  };
}
