import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import {
  type MultifactorChallengeResponse,
  readApiJson,
  type SessionTokenPair,
  type TotpBeginResponse,
  type UserResponse,
} from "@tests/api/helpers/api-response";
import { createAuthTestServices } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";
import { enrollTotp, resetTotpStep, totpCode } from "@tests/auth/helpers";

describe("auth multifactor routes", () => {
  test("POST /api/v1/auth/login returns multifactor_required when multifactor is enabled", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", true);
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<MultifactorChallengeResponse>(response);
    expect(body.data.status).toBe("multifactor_required");
    expect(body.data.multifactor_token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.methods).toEqual(["totp"]);
  });

  test("GET /api/v1/users/me rejects a multifactor bearer token", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", true);
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

    const response = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${loginBody.data.multifactor_token}` },
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/users/me/totp/begin requires password when multifactor is off", async () => {
    const services = await createAuthTestServices();
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
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const response = await app.request(API.users.me.totp.begin, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test("POST /api/v1/auth/multifactor/verify issues an AAL2 session", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");
    await resetTotpStep(services, "alice");

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

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.multifactor_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });

    expect(verifyResponse.status).toBe(200);
    const verifyBody = await readApiJson<SessionTokenPair>(verifyResponse);
    expect(verifyBody.data.session_token).toMatch(/^[0-9a-f]{64}$/);

    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${verifyBody.data.session_token}` },
    });
    const meBody = await readApiJson<UserResponse>(meResponse);
    expect(meBody.data.multifactor_methods).toEqual(["totp"]);
    expect(meBody.data.recovery_codes_enabled).toBe(false);
  });

  test("POST /api/v1/users/me/totp/confirm enrolls TOTP", async () => {
    const services = await createAuthTestServices();
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
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const beginResponse = await app.request(API.users.me.totp.begin, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "password123" }),
    });
    const beginBody = await readApiJson<TotpBeginResponse>(beginResponse);
    const secretMatch = /secret=([A-Z2-7]+)/.exec(beginBody.data.uri);
    const secret = secretMatch?.[1];
    if (!secret) {
      throw new Error("missing secret");
    }

    const confirmResponse = await app.request(API.users.me.totp.confirm, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: totpCode(secret) }),
    });

    expect(confirmResponse.status).toBe(200);
    const confirmBody = await readApiJson<SessionTokenPair>(confirmResponse);
    expect(confirmBody.data.session_token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("POST /api/v1/auth/multifactor/verify rejects a bad TOTP code", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", false);
    await enrollTotp(services, "alice", "password123");
    await resetTotpStep(services, "alice");

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

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.multifactor_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: "000000" }),
    });

    expect(verifyResponse.status).toBe(401);
  });

  test("POST /api/v1/auth/multifactor/verify rejects missing proof", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", true);
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

    const verifyResponse = await app.request(API.auth.session.multifactor.otp, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.multifactor_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(verifyResponse.status).toBe(400);
  });

  test("POST /api/v1/users/me/codes rejects when multifactor is off", async () => {
    const services = await createAuthTestServices();
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
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const response = await app.request(API.users.me.codes, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "password123" }),
    });

    expect(response.status).toBe(400);
  });

  test("DELETE /api/v1/users/me/totp disables TOTP", async () => {
    const services = await createAuthTestServices("alice", "password123", "user", false);
    const secret = await enrollTotp(services, "alice", "password123");
    await resetTotpStep(services, "alice");

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

    const disableResponse = await app.request(API.users.me.totp.disable, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${verifyBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totp: totpCode(secret) }),
    });

    expect(disableResponse.status).toBe(200);

    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${verifyBody.data.session_token}` },
    });
    expect(meResponse.status).toBe(401);
  });
});
