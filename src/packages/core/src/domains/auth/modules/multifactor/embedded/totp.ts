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

export function generateTotpSecret(username: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 });
  const totp = createTotp(username, secret);

  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

export function totpProvisioningUri(username: string, secretBase32: string): string {
  const secret = Secret.fromBase32(secretBase32);
  return createTotp(username, secret).toString();
}

export function validateTotpCode(
  secretBase32: string,
  code: string,
  skew: number,
  lastStep: number | null
): { valid: boolean; step: number } {
  const secret = Secret.fromBase32(secretBase32);
  const totp = createTotp("", secret);
  const step = Math.floor(Date.now() / 1000 / TOTP_PERIOD);

  if (lastStep !== null) {
    for (let s = lastStep; s >= lastStep - skew; s -= 1) {
      if (totp.validate({ token: code, timestamp: s * TOTP_PERIOD * 1000, window: 0 }) !== null) {
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
}

export function currentTotpStep(): number {
  return Math.floor(Date.now() / 1000 / TOTP_PERIOD);
}
