import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleRecoveryCodeRepository } from "@database/repositories/auth/drizzle-recovery-code-repository";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { authMultifactorCodes } from "@database/schema/auth/multifactor-codes";
import { users } from "@database/schema/users/index";
import type { DbClientHandle } from "@database/types";
import { RecoveryCode, User, Username } from "@ndb/core";
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

describe("DrizzleRecoveryCodeRepository", () => {
  let db: DbClientHandle | undefined;
  const createdUserIds: string[] = [];
  const createdCodeIds: string[] = [];

  beforeAll(() => {
    db = createDbClient({ config: parseDbEnv() });
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const id of createdCodeIds) {
      await db.client.delete(authMultifactorCodes).where(eq(authMultifactorCodes.id, id));
    }

    for (const id of createdUserIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates, consumes, and counts unused recovery codes", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const repo = new DrizzleRecoveryCodeRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const now = new Date();
    const code = new RecoveryCode(crypto.randomUUID(), user.id, "hash-1", now);
    createdCodeIds.push(code.id);
    await repo.create([code]);

    expect(await repo.aggregate({ userId: user.id, unused: true })).toBe(1);
    const [found] = await repo.findByFilters(
      { userId: user.id, codeHash: "hash-1", unused: true },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(found?.id).toBe(code.id);

    if (!found) {
      throw new Error("expected recovery code");
    }

    await repo.save(found.withUsed(new Date()));
    expect(await repo.aggregate({ userId: user.id, unused: true })).toBe(0);
  });
});
