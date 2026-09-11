import { describe, expect, test } from "bun:test";
import { createTokenDigest } from "@auth/tokens";
import { Session } from "@core/domains/auth/entities/session";
import { isSessionTokenPair } from "@core/domains/auth/helpers";
import { ForbiddenError, UnauthorizedError } from "@core/shared/errors/domain-error";
import {
  createTestAuthServices,
  createTestSecurityStores,
  loginAsSession,
  TEST_MULTIFACTOR_CONFIG,
  TEST_SESSION_TTL,
} from "@tests/auth/helpers";
import { getByUsername } from "@tests/auth/helpers/helpers";

describe("AuthService", () => {
  test("logs in with a valid password", async () => {
    const { auth } = await createTestAuthServices();
    const pair = await auth.login("alice", "password123");
    if (!isSessionTokenPair(pair)) {
      throw new Error("expected session pair");
    }

    expect(pair.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(pair.expiresIn).toBe(Math.floor(TEST_SESSION_TTL / 1000));
  });

  test("rejects a bad password", async () => {
    const { auth } = await createTestAuthServices();
    await expect(auth.login("alice", "wrong-password")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("rejects an unknown user", async () => {
    const { auth } = await createTestAuthServices();
    await expect(auth.login("missing", "password123")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("locks out a username after repeated bad passwords", async () => {
    const securityStores = createTestSecurityStores();
    const services = await createTestAuthServices(
      "lockuser",
      "password123",
      "user",
      false,
      securityStores
    );

    for (let attempt = 0; attempt < TEST_MULTIFACTOR_CONFIG.mfaMaxFailures; attempt += 1) {
      await expect(services.auth.login("lockuser", "wrong-password")).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    }

    await expect(services.auth.login("lockuser", "password123")).rejects.toThrow(
      "core.auth.unauthorized.invalid-credentials"
    );
  });

  test("successful login resets password lockout", async () => {
    const securityStores = createTestSecurityStores();
    const services = await createTestAuthServices(
      "resetuser",
      "password123",
      "user",
      false,
      securityStores
    );

    await expect(services.auth.login("resetuser", "wrong-password")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    await services.auth.login("resetuser", "password123");
    await expect(services.auth.login("resetuser", "wrong-password")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  test("refreshes a session and rotates refresh tokens", async () => {
    const services = await createTestAuthServices();
    const first = await services.auth.login("alice", "password123");
    if (!isSessionTokenPair(first)) {
      throw new Error("expected session pair");
    }

    const second = await services.auth.refresh(first.refreshToken);

    expect(second.sessionToken).not.toBe(first.sessionToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(services.auth.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  test("logs out by revoking the access token", async () => {
    const services = await createTestAuthServices();
    const pair = await services.auth.login("alice", "password123");
    if (!isSessionTokenPair(pair)) {
      throw new Error("expected session pair");
    }

    const resolved = await services.auth.get(pair.sessionToken);
    await services.auth.logout(resolved.sessionId);
    await expect(services.auth.get(pair.sessionToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("rejects expired access tokens", async () => {
    const services = await createTestAuthServices("bob", "password123");
    const pair = await services.auth.login("bob", "password123");
    if (!isSessionTokenPair(pair)) {
      throw new Error("expected session pair");
    }

    const [session] = await services.sessions.findByFilters(
      { sessionHash: createTokenDigest().sha256Hex(pair.sessionToken) },
      undefined,
      { limit: 1, offset: 0 }
    );
    if (!session) {
      throw new Error("session not found");
    }

    const expired = new Session(
      session.id,
      session.userId,
      session.sessionHash,
      session.refreshHash,
      new Date(Date.now() - 1_000),
      session.refreshExpiresAt,
      session.createdAt,
      session.authAmr,
      session.authAcr,
      session.revokedAt
    );
    await services.sessions.save(expired);

    await expect(services.auth.get(pair.sessionToken)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("resolves a valid session", async () => {
    const services = await createTestAuthServices();
    const token = await loginAsSession(services, "alice", "password123");
    const resolved = await services.auth.get(token);

    expect(resolved.user.username.toString()).toBe("alice");
    expect(resolved.user.role).toBe("user");
    expect(resolved.user.multifactorEnabled).toBe(false);
    expect(resolved.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test("changePassword revokes old refresh tokens", async () => {
    const services = await createTestAuthServices();
    const login = await services.auth.login("alice", "password123");
    if (!isSessionTokenPair(login)) {
      throw new Error("expected session pair");
    }

    const actor = (await services.auth.get(login.sessionToken)).user;
    const next = await services.auth.updatePassword(
      actor,
      "aal1",
      "pwd",
      "password123",
      "newpassword1"
    );
    await expect(services.auth.refresh(login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    await expect(services.auth.get(next.sessionToken)).resolves.toBeDefined();
  });

  test("changePassword requires AAL2 when multifactor is enabled", async () => {
    const services = await createTestAuthServices("alice", "password123", "user", true);
    const user = await getByUsername(services.users, "alice");

    await expect(
      services.auth.updatePassword(user, "aal1", "pwd", "password123", "newpassword1")
    ).rejects.toThrow("core.auth.context.unauthorized.multifactor-step-up-required");
  });

  test("register creates a user for administrators", async () => {
    const services = await createTestAuthServices("admin", "password123", "administrator");
    const admin = (await services.auth.get(await loginAsSession(services, "admin", "password123")))
      .user;
    const created = await services.auth.register(admin, "aal1", {
      username: "bob",
      password: "password123",
    });

    expect(created.username.toString()).toBe("bob");
    expect(created.role).toBe("user");
  });

  test("register rejects non-administrators", async () => {
    const services = await createTestAuthServices("alice", "password123", "user");
    const user = (await services.auth.get(await loginAsSession(services, "alice", "password123")))
      .user;

    await expect(
      services.auth.register(user, "aal1", {
        username: "carol",
        password: "password123",
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("changeOwnUsername revokes old refresh tokens", async () => {
    const services = await createTestAuthServices();
    const login = await services.auth.login("alice", "password123");
    if (!isSessionTokenPair(login)) {
      throw new Error("expected session pair");
    }

    const actor = (await services.auth.get(login.sessionToken)).user;
    const next = await services.auth.updateUsername(actor, "aal1", "pwd", "alice2", "password123");
    await expect(services.auth.refresh(login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    await expect(services.auth.get(next.sessionToken)).resolves.toBeDefined();
  });
});
