import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import {
  type ApiDataEnvelope,
  type MultifactorChallengeResponse,
  readApiData,
  readApiJson,
  type SessionTokenPair,
  type TotpBeginResponse,
  type UserResponse,
} from "@tests/api/helpers/api-response";
import type { AuthTestServices } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { enrollTotp, resetTotpStep, totpCode } from "@tests/auth/helpers";

function totpServices(services: AuthTestServices) {
  return { users: services.users, auth: services.authService };
}

describe("auth multifactor routes", () => {
  test("POST /api/v1/auth/login returns multifactor_required when multifactor is enabled", async () => {
    const { app } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
      multifactorEnabled: true,
    });

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<ApiDataEnvelope<MultifactorChallengeResponse>>(response);
    expect(body.data.status).toBe("multifactor_required");
    expect(body.data.multifactorToken).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.methods).toEqual(["totp"]);
  });

  test("GET /api/v1/users/me rejects a multifactor bearer token", async () => {
    const { app } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
      multifactorEnabled: true,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<MultifactorChallengeResponse>(loginResponse);

    const response = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${loginBody.multifactorToken}` },
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/users/me/totp/begin requires password when multifactor is off", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<SessionTokenPair>(loginResponse);

    const response = await app.request(API.users.me.totp.begin, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test("POST /api/v1/auth/multifactor/verify issues an AAL2 session", async () => {
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

    expect(verifyResponse.status).toBe(200);
    const verifyBody = await readApiData<SessionTokenPair>(verifyResponse);
    expect(verifyBody.sessionToken).toMatch(/^[0-9a-f]{64}$/);

    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${verifyBody.sessionToken}` },
    });
    const meBody = await readApiData<UserResponse>(meResponse);
    expect(meBody.multifactorMethods).toEqual(["totp"]);
    expect(meBody.recoveryCodesEnabled).toBe(false);
  });

  test("POST /api/v1/users/me/totp/confirm enrolls TOTP", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<SessionTokenPair>(loginResponse);

    const beginResponse = await app.request(API.users.me.totp.begin, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "password123" }),
    });
    const beginBody = await readApiData<TotpBeginResponse>(beginResponse);
    const secretMatch = /secret=([A-Z2-7]+)/.exec(beginBody.uri);
    const secret = secretMatch?.[1];
    if (!secret) {
      throw new Error("missing secret");
    }

    const confirmResponse = await app.request(API.users.me.totp.confirm, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: totpCode(secret) }),
    });

    expect(confirmResponse.status).toBe(200);
    const confirmBody = await readApiData<SessionTokenPair>(confirmResponse);
    expect(confirmBody.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test("POST /api/v1/auth/multifactor/verify rejects a bad TOTP code", async () => {
    const { app, services } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
      multifactorEnabled: false,
    });
    await enrollTotp(totpServices(services), "alice", "password123");

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<MultifactorChallengeResponse>(loginResponse);

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.multifactorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: "000000" }),
    });

    expect(verifyResponse.status).toBe(401);
  });

  test("POST /api/v1/auth/multifactor/verify rejects missing proof", async () => {
    const { app } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
      multifactorEnabled: true,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<MultifactorChallengeResponse>(loginResponse);

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.multifactorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(verifyResponse.status).toBe(400);
  });

  test("POST /api/v1/users/me/codes rejects when multifactor is off", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<SessionTokenPair>(loginResponse);

    const response = await app.request(API.users.me.codes, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "password123" }),
    });

    expect(response.status).toBe(400);
  });

  test("DELETE /api/v1/users/me/totp disables TOTP", async () => {
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

    const disableResponse = await app.request(API.users.me.totp.disable, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${verifyBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });

    expect(disableResponse.status).toBe(204);

    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${verifyBody.sessionToken}` },
    });
    expect(meResponse.status).toBe(401);
  });
});
