import { describe, expect, test } from "bun:test";
import { AUTH_AMR_RECOVERY, isSessionTokenPair } from "@core/domains/auth/helpers";
import { createTestAuthServices, enrollTotp, resetTotpStep, totpCode } from "@tests/auth/helpers";
import { firstElement } from "@tests/auth/helpers/assert";
import { getByUsername } from "@tests/auth/helpers/helpers";

describe("recovery codes", () => {
  test("generate returns ten codes and login challenge includes recovery", async () => {
    const services = await createTestAuthServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");
    const user = await resetTotpStep(services, "alice");
    const codes = await services.auth.multifactor.generateCodes(user, {
      totp: totpCode(secret),
    });
    expect(codes).toHaveLength(10);

    const challenge = await services.auth.login("alice", "password123");
    if (isSessionTokenPair(challenge)) {
      throw new Error("expected multifactor challenge");
    }

    expect(challenge.methods).toContain("recovery");
  });

  test("verifyLoginRecoveryCode issues AAL2 with rcc amr", async () => {
    const services = await createTestAuthServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");
    const user = await resetTotpStep(services, "alice");
    const codes = await services.auth.multifactor.generateCodes(user, {
      totp: totpCode(secret),
    });

    await resetTotpStep(services, "alice");

    const challenge = await services.auth.login("alice", "password123");
    if (isSessionTokenPair(challenge)) {
      throw new Error("expected multifactor challenge");
    }

    const pair = await services.auth.multifactor.verifyRecoveryCode(
      challenge.multifactorToken,
      firstElement(codes, "recovery code")
    );
    const resolved = await services.auth.get(pair.sessionToken);
    expect(resolved.authAmr).toContain(AUTH_AMR_RECOVERY);
    expect(resolved.authAcr).toBe("aal2");
  });

  test("clearRecoveryCodes removes unused codes", async () => {
    const services = await createTestAuthServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");
    let user = await resetTotpStep(services, "alice");
    await services.auth.multifactor.generateCodes(user, { totp: totpCode(secret) });
    user = await resetTotpStep(services, "alice");

    await services.auth.multifactor.clearCodes(user, { totp: totpCode(secret) });
    const refreshedUser = await getByUsername(services.users, "alice");
    const state = await services.auth.multifactor.buildState(refreshedUser);
    expect(state.recoveryCodesEnabled).toBe(false);
  });
});
