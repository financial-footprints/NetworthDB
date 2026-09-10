import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { users } from "@database/schema/users/index";
import type { DbClientHandle } from "@database/types";
import { ConflictError, User, Username } from "@ndb/core";
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

describe("DrizzleUserRepository", () => {
  let db: DbClientHandle | undefined;
  const createdIds: string[] = [];

  beforeAll(() => {
    db = createDbClient({ config: parseDbEnv() });
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const id of createdIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates and finds a user", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const repo = new DrizzleUserRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdIds.push(user.id);

    const created = await repo.create(user);
    expect(created.username.toString()).toBe(user.username.toString());
    expect(created.e2eeName).toBeNull();

    const [byUsername] = await repo.findByFilters({ username: user.username }, undefined, {
      limit: 1,
      offset: 0,
    });
    expect(byUsername?.id).toBe(user.id);

    const byId = await repo.findById(user.id);
    expect(byId?.username.toString()).toBe(user.username.toString());
  });

  test("saves, lists, and deletes a user", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const repo = new DrizzleUserRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdIds.push(user.id);
    await repo.create(user);

    const renamed = user.withUsername(Username.parse(`${user.username.toString()}_new`));
    const saved = await repo.save(renamed);
    expect(saved.username.toString()).toBe(renamed.username.toString());

    const filters = { search: renamed.username.toString().slice(0, 4) };
    const total = await repo.aggregate(filters);
    expect(total).toBeGreaterThanOrEqual(1);

    await repo.delete({ id: user.id });
    createdIds.pop();
    expect(await repo.findById(user.id)).toBeNull();
  });

  test("rejects a duplicate username", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const repo = new DrizzleUserRepository(db.client);
    const username = uniqueUsername();
    const first = fixtureUser(username);
    createdIds.push(first.id);
    await repo.create(first);

    const second = fixtureUser(username);
    createdIds.push(second.id);
    await expect(repo.create(second)).rejects.toBeInstanceOf(ConflictError);
  });
});
