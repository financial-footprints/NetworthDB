const { Secret, TOTP } = require("otpauth/dist/otpauth.node.cjs");

const TOTP_PERIOD = 30;

function createTotp(base32Secret) {
  return new TOTP({
    secret: Secret.fromBase32(base32Secret),
    algorithm: "SHA1",
    digits: 6,
    period: TOTP_PERIOD,
  });
}

function generateTotpCode(base32Secret) {
  return createTotp(base32Secret).generate();
}

function generateNextTotpCode(base32Secret) {
  const currentStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  const nextStepTimestamp = (currentStep + 1) * TOTP_PERIOD * 1000;

  return createTotp(base32Secret).generate({ timestamp: nextStepTimestamp });
}

module.exports = { generateTotpCode, generateNextTotpCode };
