import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import {
  type MultifactorChallengeResponse,
  type RecoveryCodesResponse,
  readApiData,
  type SessionTokenPair,
} from "@tests/api/helpers/api-response";
import type { AuthTestServices } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { enrollTotp, resetTotpStep, totpCode } from "@tests/auth/helpers";

function totpServices(services: AuthTestServices) {
  return { users: services.users, auth: services.authService };
}

describe("auth recovery routes", () => {
  test("POST /api/v1/users/me/codes returns ten codes", async () => {
    const { app, services } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
      multifactorEnabled: false,
    });
    const secret = await enrollTotp(totpServices(services), "alice", "password123");

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<MultifactorChallengeResponse>(loginResponse);
    await resetTotpStep(services, "alice");

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.multifactorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });
    const verifyBody = await readApiData<SessionTokenPair>(verifyResponse);
    await resetTotpStep(services, "alice");

    const response = await app.request(API.users.me.codes, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${verifyBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });

    expect(response.status).toBe(200);
    const body = await readApiData<RecoveryCodesResponse>(response);
    expect(body.recoveryCodes).toHaveLength(10);
  });

  test("POST /api/v1/auth/multifactor/verify accepts recovery_code", async () => {
    const { app, services } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
      multifactorEnabled: false,
    });
    const secret = await enrollTotp(totpServices(services), "alice", "password123");

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<MultifactorChallengeResponse>(loginResponse);
    await resetTotpStep(services, "alice");

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.multifactorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });
    const verifyBody = await readApiData<SessionTokenPair>(verifyResponse);
    await resetTotpStep(services, "alice");

    const generateResponse = await app.request(API.users.me.codes, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${verifyBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });
    const generateBody = await readApiData<RecoveryCodesResponse>(generateResponse);
    await resetTotpStep(services, "alice");

    const challengeResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const challengeBody = await readApiData<MultifactorChallengeResponse>(challengeResponse);

    const recoveryVerify = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${challengeBody.multifactorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recoveryCode: generateBody.recoveryCodes[0] }),
    });

    expect(recoveryVerify.status).toBe(200);
    const recoveryBody = await readApiData<SessionTokenPair>(recoveryVerify);
    expect(recoveryBody.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });
});
