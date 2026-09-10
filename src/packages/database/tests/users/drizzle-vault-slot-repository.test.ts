import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { DrizzleVaultSlotRepository } from "@database/repositories/users/drizzle-vault-slot-repository";
import { users } from "@database/schema/users/index";
import { usersVault } from "@database/schema/users/vault";
import type { DbClientHandle } from "@database/types";
import { ConflictError, User, Username, VAULT_SLOT_TYPE_PASSWORD, VaultSlot } from "@ndb/core";
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

describe("DrizzleVaultSlotRepository", () => {
  let db: DbClientHandle | undefined;
  const createdUserIds: string[] = [];
  const createdSlotIds: string[] = [];

  beforeAll(() => {
    db = createDbClient({ config: parseDbEnv() });
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const id of createdSlotIds) {
      await db.client.delete(usersVault).where(eq(usersVault.id, id));
    }

    for (const id of createdUserIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates, lists, updates wrap, and deletes", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const repo = new DrizzleVaultSlotRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const now = new Date();
    const slot = new VaultSlot(
      crypto.randomUUID(),
      user.id,
      VAULT_SLOT_TYPE_PASSWORD,
      "AQIDBAUGBwgJCgsMDQ4PEA",
      "abc.def",
      "",
      null,
      now,
      now
    );
    createdSlotIds.push(slot.id);
    await repo.create(slot);

    const listed = await repo.findByFilters({ userId: user.id });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.slotType).toBe(VAULT_SLOT_TYPE_PASSWORD);

    const [updated] = await repo.update(
      { id: slot.id },
      { salt: "salt-two", wrapBlob: "ghi.jkl", updatedAt: new Date() }
    );
    expect(updated?.salt).toBe("salt-two");
    expect(updated?.wrapBlob).toBe("ghi.jkl");

    await repo.delete({ id: slot.id });
    expect(await repo.aggregate({ userId: user.id })).toBe(0);
  });

  test("rejects a second password slot for the same user", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const repo = new DrizzleVaultSlotRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const now = new Date();
    const first = new VaultSlot(
      crypto.randomUUID(),
      user.id,
      VAULT_SLOT_TYPE_PASSWORD,
      "AQIDBAUGBwgJCgsMDQ4PEA",
      "abc.def",
      "",
      null,
      now,
      now
    );
    createdSlotIds.push(first.id);
    await repo.create(first);

    const second = new VaultSlot(
      crypto.randomUUID(),
      user.id,
      VAULT_SLOT_TYPE_PASSWORD,
      "BQIDBAUGBwgJCgsMDQ4PEB",
      "ghi.jkl",
      "",
      null,
      now,
      now
    );
    createdSlotIds.push(second.id);

    await expect(repo.create(second)).rejects.toBeInstanceOf(ConflictError);
  });
});
