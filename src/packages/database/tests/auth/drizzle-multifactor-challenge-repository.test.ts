import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleMultifactorChallengeRepository } from "@database/repositories/auth/drizzle-multifactor-challenge-repository";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { authMultifactor } from "@database/schema/auth/multifactor";
import { users } from "@database/schema/users/index";
import type { DbClientHandle } from "@database/types";
import { MultifactorChallenge, User, Username } from "@ndb/core";
import { eq } from "drizzle-orm";

function fixtureUser(username: string): User {
  return new User(
    crypto.randomUUID(),
    Username.parse(username),
    "$argon2id$v=19$m=65536,t=2,p=4$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "user",
    false,
    new Date()
  );
}

function uniqueUsername(): string {
  return `u${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

describe("DrizzleMultifactorChallengeRepository", () => {
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
      await db.client.delete(authMultifactor).where(eq(authMultifactor.id, id));
    }

    for (const id of createdUserIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates, finds, and marks a challenge used", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const repo = new DrizzleMultifactorChallengeRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const now = new Date();
    const challenge = new MultifactorChallenge(
      crypto.randomUUID(),
      user.id,
      `hash-${crypto.randomUUID()}`,
      new Date(now.getTime() + 60_000),
      now
    );
    createdChallengeIds.push(challenge.id);

    const created = await repo.create(challenge);
    expect(created.tokenHash).toBe(challenge.tokenHash);

    const [byHash] = await repo.findByFilters({ tokenHash: challenge.tokenHash }, undefined, {
      limit: 1,
      offset: 0,
    });
    expect(byHash?.id).toBe(challenge.id);

    const used = await repo.save(created.withUsed(new Date()));
    expect(used.usedAt).not.toBeNull();
    expect(used.isValid()).toBe(false);
  });
});
