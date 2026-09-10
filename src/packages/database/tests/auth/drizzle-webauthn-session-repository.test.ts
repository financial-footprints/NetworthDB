import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleWebAuthnSessionRepository } from "@database/repositories/auth/drizzle-webauthn-session-repository";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { authWebauthn } from "@database/schema/auth/webauthn";
import { users } from "@database/schema/users/index";
import type { DbClientHandle } from "@database/types";
import { User, Username, WebAuthnSession } from "@ndb/core";
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

function fixtureSession(userId: string): WebAuthnSession {
  const now = new Date();
  return new WebAuthnSession(
    crypto.randomUUID(),
    userId,
    Buffer.from("session-data"),
    new Date(now.getTime() + 5 * 60 * 1000),
    now
  );
}

function uniqueUsername(): string {
  return `s${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

describe("DrizzleWebAuthnSessionRepository", () => {
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
      await db.client.delete(authWebauthn).where(eq(authWebauthn.id, id));
    }

    for (const id of createdUserIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates and finds ceremony sessions", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const sessionRepo = new DrizzleWebAuthnSessionRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const session = fixtureSession(user.id);
    createdSessionIds.push(session.id);
    const created = await sessionRepo.create(session);

    expect(created.userId).toBe(user.id);

    const found = await sessionRepo.findById(session.id);
    expect(found?.sessionData.toString()).toBe("session-data");
    expect(found?.isValid()).toBe(true);
  });

  test("deletes sessions for a user", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const sessionRepo = new DrizzleWebAuthnSessionRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const session = fixtureSession(user.id);
    createdSessionIds.push(session.id);
    await sessionRepo.create(session);

    await sessionRepo.delete({ userId: user.id });
    createdSessionIds.pop();
    expect(await sessionRepo.findById(session.id)).toBeNull();
  });
});
