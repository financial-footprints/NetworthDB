import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import {
  type MultifactorChallengeResponse,
  type RecoveryCodesResponse,
  readApiJson,
  type SessionTokenPair,
} from "@tests/api/helpers/api-response";
import { createAuthTestServices } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";
import { enrollTotp, resetTotpStep, totpCode } from "@tests/core/helpers/auth";

describe("auth recovery routes", () => {
  test("POST /api/v1/users/me/codes returns ten codes", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<MultifactorChallengeResponse>(loginResponse);
    await resetTotpStep(services, "alice");

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.multifactor_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });
    const verifyBody = await readApiJson<SessionTokenPair>(verifyResponse);
    await resetTotpStep(services, "alice");

    const response = await app.request(API.users.me.codes, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${verifyBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<RecoveryCodesResponse>(response);
    expect(body.data.recovery_codes).toHaveLength(10);
  });

  test("POST /api/v1/auth/multifactor/verify accepts recovery_code", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<MultifactorChallengeResponse>(loginResponse);
    await resetTotpStep(services, "alice");

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.multifactor_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });
    const verifyBody = await readApiJson<SessionTokenPair>(verifyResponse);
    await resetTotpStep(services, "alice");

    const generateResponse = await app.request(API.users.me.codes, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${verifyBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });
    const generateBody = await readApiJson<RecoveryCodesResponse>(generateResponse);
    await resetTotpStep(services, "alice");

    const challengeResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const challengeBody = await readApiJson<MultifactorChallengeResponse>(challengeResponse);

    const recoveryVerify = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${challengeBody.data.multifactor_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recovery_code: generateBody.data.recovery_codes[0] }),
    });

    expect(recoveryVerify.status).toBe(200);
    const recoveryBody = await readApiJson<SessionTokenPair>(recoveryVerify);
    expect(recoveryBody.data.session_token).toMatch(/^[0-9a-f]{64}$/);
  });
});
