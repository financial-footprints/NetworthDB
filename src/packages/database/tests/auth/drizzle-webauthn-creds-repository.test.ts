import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { DrizzleWebAuthnCredsRepository } from "@database/repositories/auth/drizzle-webauthn-creds-repository";
import { DrizzleUserRepository } from "@database/repositories/users/drizzle-user-repository";
import { authWebauthnCreds } from "@database/schema/auth/webauthn-credentials";
import { users } from "@database/schema/users/index";
import type { DbClientHandle } from "@database/types";
import { User, Username, WebAuthnCredential } from "@ndb/core";
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

function fixtureCredential(userId: string): WebAuthnCredential {
  return new WebAuthnCredential(
    crypto.randomUUID(),
    userId,
    Buffer.from("credential-id"),
    Buffer.from("public-key"),
    "none",
    "internal",
    0,
    false,
    false,
    "Test Passkey",
    Buffer.alloc(16),
    new Date()
  );
}

function uniqueUsername(): string {
  return `w${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

describe("DrizzleWebAuthnCredsRepository", () => {
  let db: DbClientHandle | undefined;
  const createdUserIds: string[] = [];
  const createdCredentialIds: string[] = [];

  beforeAll(() => {
    db = createDbClient({ config: parseDbEnv() });
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const id of createdCredentialIds) {
      await db.client.delete(authWebauthnCreds).where(eq(authWebauthnCreds.id, id));
    }

    for (const id of createdUserIds) {
      await db.client.delete(users).where(eq(users.id, id));
    }

    await db.close();
  });

  test("creates, lists, and deletes credentials", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const credentialRepo = new DrizzleWebAuthnCredsRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const credential = fixtureCredential(user.id);
    createdCredentialIds.push(credential.id);
    const created = await credentialRepo.create(credential);

    expect(created.name).toBe("Test Passkey");

    const listed = await credentialRepo.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(credential.id);

    const [byCredentialId] = await credentialRepo.findByFilters(
      { credentialId: credential.credentialId },
      undefined,
      { limit: 1, offset: 0 }
    );
    expect(byCredentialId?.id).toBe(credential.id);

    await credentialRepo.delete({ id: credential.id });
    createdCredentialIds.pop();
    expect(await credentialRepo.aggregate({ userId: user.id })).toBe(0);
  });

  test("delete by user removes every credential", async () => {
    if (!db) {
      throw new Error("database client was not created");
    }

    const userRepo = new DrizzleUserRepository(db.client);
    const credentialRepo = new DrizzleWebAuthnCredsRepository(db.client);
    const user = fixtureUser(uniqueUsername());
    createdUserIds.push(user.id);
    await userRepo.create(user);

    const credential = fixtureCredential(user.id);
    createdCredentialIds.push(credential.id);
    await credentialRepo.create(credential);

    await credentialRepo.delete({ userId: user.id });
    createdCredentialIds.pop();
    expect(await credentialRepo.findByFilters({ userId: user.id })).toEqual([]);
  });
});
