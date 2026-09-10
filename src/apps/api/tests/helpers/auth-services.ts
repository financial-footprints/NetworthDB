import type { createApp } from "@ndb/api";
import type { ApiServices, HealthService } from "@ndb/bootstrap";
import { hashPassword, type Role, User, Username, UserService } from "@ndb/core";
import { API } from "@ndb/platform";
import { readApiJson, type SessionTokenPair } from "@tests/api/helpers/api-response";
import {
  CapturingEmailSender,
  createTestSecurityStores,
  loginAsSession,
  TEST_WEBAUTHN_CONFIG,
} from "@tests/core/helpers/auth";
import { createInMemoryAuthRepos, wireInMemoryAuth } from "@tests/core/helpers/auth/wiring";

const WEBAUTHN_ENABLED_CONFIG = {
  ...TEST_WEBAUTHN_CONFIG,
  rp: {
    rpId: "localhost",
    rpDisplayName: "NetworthDB",
    rpOrigins: ["http://localhost:3000"],
  },
};

export type AuthTestServices = ApiServices & {
  users: ReturnType<typeof createInMemoryAuthRepos>["users"];
  emailSender: CapturingEmailSender;
};

export async function createAuthTestServices(
  username = "alice",
  password = "password123",
  role: Role = "user",
  multifactorEnabled = false,
  webauthnEnabled = false,
  securityStores = createTestSecurityStores()
): Promise<AuthTestServices> {
  const repos = createInMemoryAuthRepos();
  const emailSender = new CapturingEmailSender();
  const passwordHash = await hashPassword(password);

  await repos.users.create(
    new User(
      crypto.randomUUID(),
      Username.parse(username),
      passwordHash,
      role,
      multifactorEnabled,
      new Date()
    )
  );

  const { auth, vault } = wireInMemoryAuth(
    repos,
    emailSender,
    securityStores,
    webauthnEnabled ? WEBAUTHN_ENABLED_CONFIG : TEST_WEBAUTHN_CONFIG
  );

  return {
    health: {
      check: async () => ({ ok: true }),
    } as HealthService,
    user: new UserService(repos.users, auth, "local"),
    vault,
    auth,
    users: repos.users,
    emailSender,
  };
}

export async function loginViaApp(
  app: ReturnType<typeof createApp>,
  username: string,
  password: string
): Promise<string> {
  const response = await app.request(API.auth.session.login, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (response.status !== 200) {
    const body = await response.text();
    throw new Error(`login failed with status ${response.status}: ${body}`);
  }

  const body = await readApiJson<SessionTokenPair>(response);
  return body.data.session_token;
}

export async function loginAs(
  services: ApiServices,
  username: string,
  password: string
): Promise<string> {
  return loginAsSession(services, username, password);
}
