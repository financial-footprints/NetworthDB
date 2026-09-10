import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleRecoveryChallengeRepository } from "@database/repositories/auth/drizzle-recovery-challenge-repository";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { authRecovery } from "@database/schema/auth/recovery";
import { users } from "@database/schema/users/index";
import type { DbClientHandle } from "@database/types";
import { RECOVERY_KIND_PASSWORD_RESET, RecoveryChallenge, User, Username } from "@ndb/core";
import { eq } from "drizzle-orm";

function fixtureUser(username: string): User {
  return new User(
    crypto.randomUUID(),
    Username.parse(username),
    "$argon2id$v=19$m=65536,t=2,p=4$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "user",
    true,
    new Date()
  );
}

function uniqueUsername(): string {
  return `u${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

describe("DrizzleRecoveryChallengeRepository", () => {
  let db: DbClientHandle | undefined;
  const createdUserIds: string[] = [];
  const createdChallengeIds: string[] = [];

  beforeAll(() => {
    db = createDbClient({ config: parseDbEnv() });
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const id of createdChallengeIds) {
      await db.client.delete(authRecovery).where(eq(authRecovery.id, id));
    }

    for (const id of createdUserIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates, finds active, invalidates, and marks used", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const repo = new DrizzleRecoveryChallengeRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const now = new Date();
    const challenge = new RecoveryChallenge(
      crypto.randomUUID(),
      user.id,
      RECOVERY_KIND_PASSWORD_RESET,
      "abc123hash",
      new Date(now.getTime() + 60_000),
      now
    );
    createdChallengeIds.push(challenge.id);
    await repo.create(challenge);

    const [found] = await repo.findByFilters(
      {
        kind: RECOVERY_KIND_PASSWORD_RESET,
        secretHash: "abc123hash",
        active: true,
      },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(found?.id).toBe(challenge.id);

    await repo.update(
      { userId: user.id, kind: RECOVERY_KIND_PASSWORD_RESET, active: true },
      { usedAt: new Date() }
    );
    const [invalidated] = await repo.findByFilters(
      {
        kind: RECOVERY_KIND_PASSWORD_RESET,
        secretHash: "abc123hash",
        active: true,
      },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(invalidated).toBeUndefined();

    const replacement = new RecoveryChallenge(
      crypto.randomUUID(),
      user.id,
      RECOVERY_KIND_PASSWORD_RESET,
      "def456hash",
      new Date(now.getTime() + 60_000),
      now
    );
    createdChallengeIds.push(replacement.id);
    await repo.create(replacement);

    await repo.update({ id: replacement.id }, { usedAt: new Date() });
    const [used] = await repo.findByFilters(
      {
        kind: RECOVERY_KIND_PASSWORD_RESET,
        secretHash: "def456hash",
        active: true,
      },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(used).toBeUndefined();
  });
});
