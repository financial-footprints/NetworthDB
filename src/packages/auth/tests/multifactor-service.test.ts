import { describe, expect, test } from "bun:test";
import { createTotpEngine } from "@auth/totp";
import { isSessionTokenPair } from "@core/domains/auth/helpers";
import { UnauthorizedError, ValidationError } from "@core/shared/errors/domain-error";
import { encryptString } from "@ndb/encryption";
import {
  createTestAuthServices,
  enrollTotp,
  secretFromUri,
  TEST_MFA_SECRET,
  totpCode,
} from "@tests/auth/helpers";
import { getByUsername } from "@tests/auth/helpers/helpers";

describe("MultifactorService", () => {
  test("login forks to multifactor_required when multifactor is enabled", async () => {
    const services = await createTestAuthServices("alice", "password123", "user", true);
    const result = await services.auth.login("alice", "password123");

    expect(isSessionTokenPair(result)).toBe(false);
    if (isSessionTokenPair(result)) {
      throw new Error("expected multifactor challenge");
    }

    expect(result.status).toBe("multifactor_required");
    expect(result.methods).toEqual(["totp"]);
    expect(result.multifactorToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test("verifyLoginTotp issues an AAL2 session and consumes the challenge", async () => {
    const services = await createTestAuthServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");

    let user = await getByUsername(services.users, "alice");
    user = await services.users.save(
      user.withTotp(user.totp.withLastStep(createTotpEngine().currentStep() - 2))
    );

    const challenge = await services.auth.login("alice", "password123");
    if (isSessionTokenPair(challenge)) {
      throw new Error("expected multifactor challenge");
    }

    const pair = await services.auth.multifactor.verifyTotp(
      challenge.multifactorToken,
      totpCode(secret)
    );
    const resolved = await services.auth.get(pair.sessionToken);

    expect(resolved.authAcr).toBe("aal2");
    expect(resolved.authAmr).toBe("pwd,otp");
    await expect(
      services.auth.multifactor.verifyTotp(challenge.multifactorToken, totpCode(secret))
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("beginTotp is idempotent while pending", async () => {
    const services = await createTestAuthServices();
    const user = await getByUsername(services.users, "alice");
    const first = await services.auth.multifactor.beginTotp(
      { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
      { password: "password123" }
    );
    const second = await services.auth.multifactor.beginTotp(
      { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
      { password: "password123" }
    );

    expect(first.uri).toBe(second.uri);
  });

  test("beginTotp requires password when multifactor is off", async () => {
    const services = await createTestAuthServices();
    const user = await getByUsername(services.users, "alice");

    await expect(
      services.auth.multifactor.beginTotp(
        { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
        {}
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("disableTotp allows local users without role-required multifactor", async () => {
    const services = await createTestAuthServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");

    const login = await services.auth.login("alice", "password123");
    if (isSessionTokenPair(login)) {
      throw new Error("expected multifactor challenge");
    }

    let user = await getByUsername(services.users, "alice");
    user = await services.users.save(
      user.withTotp(user.totp.withLastStep(createTotpEngine().currentStep() - 2))
    );
    const pair = await services.auth.multifactor.verifyTotp(
      login.multifactorToken,
      totpCode(secret)
    );
    const actor = (await services.auth.get(pair.sessionToken)).user;

    user = await getByUsername(services.users, "alice");
    user = await services.users.save(
      user.withTotp(user.totp.withLastStep(createTotpEngine().currentStep() - 2))
    );

    await services.auth.multifactor.disableTotp(actor, "aal2", totpCode(secret));
    const updated = await getByUsername(services.users, "alice");
    expect(updated?.multifactorEnabled).toBe(false);
    expect(updated?.totp.hasTotp()).toBe(false);
  });

  test("confirmTotp rejects a code from the previous authenticator during rebind", async () => {
    const services = await createTestAuthServices("rebind", "password123", "user", true);
    const oldSecret = "JBSWY3DPEHPK3PXP";
    const confirmedBlob = encryptString(TEST_MFA_SECRET, oldSecret);
    let user = await getByUsername(services.users, "rebind");
    user = await services.users.save(
      user.withTotp(
        user.totp.withConfirmed(confirmedBlob, new Date(), createTotpEngine().currentStep() - 2)
      )
    );

    const login = await services.auth.login("rebind", "password123");
    if (isSessionTokenPair(login)) {
      throw new Error("expected multifactor challenge");
    }

    const bearer = await services.auth.multifactor.resolve(login.multifactorToken);
    if (bearer.kind !== "challenge") {
      throw new Error("expected challenge bearer");
    }

    const begin = await services.auth.multifactor.beginTotp(bearer, {});
    const pendingSecret = secretFromUri(begin.uri);

    await expect(
      services.auth.multifactor.confirmTotp(bearer, totpCode(oldSecret))
    ).rejects.toThrow("core.auth.multifactor.totp.unauthorized.stale-code");

    await services.auth.multifactor.confirmTotp(bearer, totpCode(pendingSecret));
  });
});
