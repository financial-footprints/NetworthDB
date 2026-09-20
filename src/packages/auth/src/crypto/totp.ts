import type { TotpEngine } from "@ndb/core";
import { Secret, TOTP } from "otpauth";

const TOTP_ISSUER = "NetworthDB";
const TOTP_PERIOD = 30;

function createTotp(username: string, secret: Secret): TOTP {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: TOTP_PERIOD,
    secret,
  });
}

export function createTotpEngine(): TotpEngine {
  return {
    generateSecret(username: string) {
      const secret = new Secret({ size: 20 });
      const totp = createTotp(username, secret);

      return {
        secret: secret.base32,
        uri: totp.toString(),
      };
    },

    provisioningUri(username: string, secretBase32: string) {
      const secret = Secret.fromBase32(secretBase32);
      return createTotp(username, secret).toString();
    },

    validate(secretBase32: string, code: string, skew: number, lastStep: number | null) {
      const secret = Secret.fromBase32(secretBase32);
      const totp = createTotp("", secret);
      const step = Math.floor(Date.now() / 1000 / TOTP_PERIOD);

      if (lastStep !== null) {
        for (let s = lastStep; s >= lastStep - skew; s -= 1) {
          if (
            totp.validate({ token: code, timestamp: s * TOTP_PERIOD * 1000, window: 0 }) !== null
          ) {
            return { valid: false, step };
          }
        }
      }

      const delta = totp.validate({ token: code, window: skew });
      if (delta === null) {
        return { valid: false, step };
      }

      const matchedStep = step + delta;
      if (lastStep !== null && matchedStep <= lastStep) {
        return { valid: false, step };
      }

      return { valid: true, step: matchedStep };
    },

    currentStep() {
      return Math.floor(Date.now() / 1000 / TOTP_PERIOD);
    },
  };
}
