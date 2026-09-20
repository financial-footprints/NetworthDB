import type { createApp } from "@ndb/api";
import { createPasswordHasher } from "@ndb/auth";
import type { ApiServices, HealthService } from "@ndb/bootstrap";
import { type Role, User, Username, UserService } from "@ndb/core";
import { API } from "@ndb/platform";
import { readApiJson, type SessionTokenPair } from "@tests/api/helpers/api-response";
import { createStatementsTestServices } from "@tests/api/helpers/statements-test-services";
import {
  CapturingEmailSender,
  createTestSecurityStores,
  TEST_WEBAUTHN_CONFIG,
} from "@tests/auth/helpers";
import { createInMemoryAuthRepos, wireInMemoryAuth } from "@tests/auth/helpers/wiring";

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
  securityStores = createTestSecurityStores(),
  options?: { seedUser?: boolean }
): Promise<AuthTestServices> {
  const repos = createInMemoryAuthRepos();
  const emailSender = new CapturingEmailSender();
  const seedUser = options?.seedUser ?? true;

  if (seedUser) {
    const passwordHash = await createPasswordHasher().hash(password);
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
  }

  const { auth, vault } = wireInMemoryAuth(
    repos,
    emailSender,
    securityStores,
    webauthnEnabled ? WEBAUTHN_ENABLED_CONFIG : TEST_WEBAUTHN_CONFIG
  );

  const user = new UserService(repos.users, auth);
  const pipeline = createStatementsTestServices(undefined, { vault, user });

  return {
    healthService: {
      check: async () => ({ ok: true }),
    } as HealthService,
    userService: user,
    accountService: pipeline.account,
    categoryService: pipeline.category,
    tagService: pipeline.tag,
    ruleGroupService: pipeline.ruleGroup,
    ruleService: pipeline.rule,
    ruleEngineService: pipeline.ruleEngine,
    transactionService: pipeline.transaction,
    dashboardService: pipeline.dashboard,
    sourcesService: pipeline.sources,
    jobService: pipeline.job,
    jobRunnerService: pipeline.jobRunner,
    vaultService: vault,
    authService: auth,
    backupService: pipeline.backup,
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

  const body = await readApiJson<{ data: SessionTokenPair }>(response);
  return body.data.sessionToken;
}

export { loginAsSession } from "@tests/auth/helpers";
