import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { accounts, backupExports, jobs, sources, usersVault } from "@database/schema/index";
import { users } from "@database/schema/users/index";
import type { DbClient } from "@database/types";
import { seedHashPassword } from "@ndb/auth";
import type { Role } from "@ndb/core";
import { inArray, sql } from "drizzle-orm";

const SEED_USERS = [
  { id: "00000000-0000-4000-8000-000000000001", username: "admin", role: "administrator" },
  { id: "00000000-0000-4000-8000-000000000002", username: "manasi", role: "manager" },
  { id: "00000000-0000-4000-8000-000000000003", username: "usher", role: "user" },
] as const;

function resetUserState(passwordHash: string, role: Role) {
  return {
    passwordHash,
    role,
    multifactorEnabled: false,
    multifactorFailedCount: 0,
    multifactorLockedUntil: null,
    totpConfirmedAt: null,
    totpSecret: null,
    totpPending: null,
    totpLastStep: null,
    recoveryEmailHash: null,
    recoveryEmailSetAt: null,
    displayName: null,
  };
}

async function resetSeedUserData(client: DbClient, userIds: string[]): Promise<void> {
  if (process.env.SEED_RESET_USER_DATA !== "true") {
    return;
  }

  await client.delete(jobs).where(inArray(jobs.userId, userIds));
  await client.delete(backupExports).where(inArray(backupExports.userId, userIds));
  await client.delete(accounts).where(inArray(accounts.userId, userIds));
  await client.delete(sources).where(inArray(sources.userId, userIds));
  await client.delete(usersVault).where(inArray(usersVault.userId, userIds));
}

function sqlStatements(source: string): string[] {
  return source
    .split(";\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !part.split("\n").every((line) => line.trim().startsWith("--")));
}

async function runCommonSql(client: DbClient): Promise<void> {
  const commonPath = join(import.meta.dir, "../drizzle/seed/common.sql");
  if (!existsSync(commonPath)) {
    return;
  }

  const source = readFileSync(commonPath, "utf8");
  for (const statement of sqlStatements(source)) {
    await client.execute(sql.raw(statement));
  }
}

async function seedLocalUsers(client: DbClient): Promise<void> {
  const passwordHash = await seedHashPassword("admin");
  const createdAt = new Date();
  const seedUserIds = SEED_USERS.map((seed) => seed.id);

  await resetSeedUserData(client, seedUserIds);

  for (const seed of SEED_USERS) {
    const reset = resetUserState(passwordHash, seed.role);
    await client
      .insert(users)
      .values({
        id: seed.id,
        username: seed.username,
        createdAt,
        ...reset,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: seed.username,
          ...reset,
        },
      });
  }
}

const dbHandle = createDbClient({ config: parseDbEnv() });

try {
  await runCommonSql(dbHandle.client);
  if (process.env.ENVIRONMENT !== "production") {
    await seedLocalUsers(dbHandle.client);
    await runCommonSql(dbHandle.client);
  }
} finally {
  await dbHandle.close();
}
