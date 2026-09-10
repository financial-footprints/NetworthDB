import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleSessionRepository } from "@database/repositories/auth/drizzle-session-repository";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { authSessions } from "@database/schema/auth/sessions";
import { users } from "@database/schema/users/index";
import type { DbClientHandle } from "@database/types";
import { Session, User, Username } from "@ndb/core";
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

function fixtureSession(userId: string): Session {
  const now = new Date();
  return new Session(
    crypto.randomUUID(),
    userId,
    `access-${crypto.randomUUID()}`,
    `refresh-${crypto.randomUUID()}`,
    new Date(now.getTime() + 15 * 60 * 1000),
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    now,
    "pwd",
    "aal1"
  );
}

function uniqueUsername(): string {
  return `u${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

describe("DrizzleSessionRepository", () => {
  let db: DbClientHandle | undefined;
  const createdUserIds: string[] = [];
  const createdSessionIds: string[] = [];

  beforeAll(() => {
    db = createDbClient({ config: parseDbEnv() });
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const id of createdSessionIds) {
      await db.client.delete(authSessions).where(eq(authSessions.id, id));
    }

    for (const id of createdUserIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates and finds sessions by access and refresh hashes", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const sessionRepo = new DrizzleSessionRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const session = fixtureSession(user.id);
    createdSessionIds.push(session.id);
    const created = await sessionRepo.create(session);

    expect(created.userId).toBe(user.id);

    const [byAccess] = await sessionRepo.findByFilters(
      { accessHash: session.accessHash },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(byAccess?.id).toBe(session.id);

    const [byRefresh] = await sessionRepo.findByFilters(
      { refreshHash: session.refreshHash },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(byRefresh?.id).toBe(session.id);
  });

  test("deletes all sessions for a user", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const sessionRepo = new DrizzleSessionRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const session = fixtureSession(user.id);
    createdSessionIds.push(session.id);
    await sessionRepo.create(session);

    await sessionRepo.delete({ userId: user.id });
    const [deleted] = await sessionRepo.findByFilters(
      { accessHash: session.accessHash },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(deleted).toBeUndefined();
  });

  test("saves rotated tokens and revocation", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const sessionRepo = new DrizzleSessionRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const session = fixtureSession(user.id);
    createdSessionIds.push(session.id);
    await sessionRepo.create(session);

    const rotated = session.withRotatedTokens({
      accessHash: `access-${crypto.randomUUID()}`,
      refreshHash: `refresh-${crypto.randomUUID()}`,
      accessExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      refreshExpiresAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    });
    const saved = await sessionRepo.save(rotated);
    expect(saved.accessHash).toBe(rotated.accessHash);

    const revoked = saved.withRevoked(new Date());
    await sessionRepo.save(revoked);

    const [found] = await sessionRepo.findByFilters({ accessHash: rotated.accessHash }, undefined, {
      limit: 1,
      offset: 0,
    });
    expect(found?.revokedAt).not.toBeNull();
  });
});
