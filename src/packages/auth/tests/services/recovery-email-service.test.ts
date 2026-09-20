import { describe, expect, test } from "bun:test";
import { isSessionTokenPair } from "@core/domains/auth/helpers";
import { UnauthorizedError } from "@core/shared/errors/domain-error";
import { firstElement } from "@ndb/core/tests";
import {
  createTestAuthServices,
  enrollTotp,
  resetTotpStep,
  tokenFromEmail,
  totpCode,
} from "@tests/auth/helpers";
import { getByUsername } from "@tests/auth/helpers/helpers";

describe("RecoveryService email reset", () => {
  test("setRecoveryEmail and clearRecoveryEmail update user state", async () => {
    const services = await createTestAuthServices("dana", "password123");
    const user = await getByUsername(services.users, "dana");

    await services.auth.recovery.updateEmail(user.id, "password123", "dana@example.com");
    const enrolled = await getByUsername(services.users, "dana");
    expect(enrolled.hasRecoveryEmail()).toBe(true);
    expect(enrolled.recoveryEmailSetAt).not.toBeNull();

    await services.auth.recovery.deleteEmail(enrolled.id, "password123");
    const cleared = await getByUsername(services.users, "dana");
    expect(cleared.hasRecoveryEmail()).toBe(false);
  });

  test("beginPasswordReset always returns generic message", async () => {
    const services = await createTestAuthServices("ghost", "password123");
    const result = await services.auth.recovery.beginReset("ghost", "ghost@example.com");
    expect(result.message).toContain("if an account exists");
    expect(services.emailSender.messages).toHaveLength(0);
  });

  test("completePasswordReset updates password and revokes sessions", async () => {
    const services = await createTestAuthServices("erin", "password123");
    const secret = await enrollTotp(services, "erin", "password123");
    const user = await getByUsername(services.users, "erin");
    await services.users.save(user.withMultifactorEnabled(true));
    await services.auth.recovery.updateEmail(user.id, "password123", "erin@example.com");
    await resetTotpStep(services, "erin");

    const challenge = await services.auth.login("erin", "password123");
    if (isSessionTokenPair(challenge)) {
      throw new Error("expected multifactor challenge");
    }

    const pair = await services.auth.multifactor.verifyTotp(
      challenge.multifactorToken,
      totpCode(secret)
    );
    const sessionToken = pair.sessionToken;
    expect(sessionToken.length).toBeGreaterThan(0);
    await resetTotpStep(services, "erin");

    services.emailSender.clearMessages();
    await services.auth.recovery.beginReset("erin", "erin@example.com");
    expect(services.emailSender.messages).toHaveLength(1);

    const resetToken = tokenFromEmail(firstElement(services.emailSender.messages, "email").body);
    const otp = totpCode(secret);

    await services.auth.recovery.completeReset({
      token: resetToken,
      newPassword: "newpassword456",
      multifactorProof: { totp: otp },
    });

    await expect(services.auth.login("erin", "password123")).rejects.toThrow(UnauthorizedError);

    const login = await services.auth.login("erin", "newpassword456");
    expect(isSessionTokenPair(login)).toBe(false);

    await expect(services.auth.get(sessionToken)).rejects.toThrow(UnauthorizedError);
  });

  test("verifyMultifactorProof consumes recovery_code", async () => {
    const services = await createTestAuthServices("frank", "password123");
    const secret = await enrollTotp(services, "frank", "password123");
    await resetTotpStep(services, "frank");
    const user = await getByUsername(services.users, "frank");
    const codes = await services.auth.multifactor.generateCodes(user, { totp: totpCode(secret) });
    const recoveryCode = firstElement(codes, "recovery code");

    const refreshed = await getByUsername(services.users, "frank");
    await services.auth.multifactor.verifyProof(refreshed, { recoveryCode });

    const afterUse = await getByUsername(services.users, "frank");
    await expect(services.auth.multifactor.verifyProof(afterUse, { recoveryCode })).rejects.toThrow(
      UnauthorizedError
    );
  });
});
