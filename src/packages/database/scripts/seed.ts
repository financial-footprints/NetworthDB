import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { accounts, jobs, sources, usersVault } from "@database/schema/index";
import { users } from "@database/schema/users/index";
import type { DbClient } from "@database/types";
import { seedHashPassword } from "@ndb/auth";
import type { Role } from "@ndb/core";
import { inArray } from "drizzle-orm";

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
  await client.delete(accounts).where(inArray(accounts.userId, userIds));
  await client.delete(sources).where(inArray(sources.userId, userIds));
  await client.delete(usersVault).where(inArray(usersVault.userId, userIds));
}

async function seedLocalUsers(): Promise<void> {
  const passwordHash = await seedHashPassword("admin");
  const dbHandle = createDbClient({ config: parseDbEnv() });
  const createdAt = new Date();
  const seedUserIds = SEED_USERS.map((seed) => seed.id);

  try {
    await resetSeedUserData(dbHandle.client, seedUserIds);

    for (const seed of SEED_USERS) {
      const reset = resetUserState(passwordHash, seed.role);
      await dbHandle.client
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
  } finally {
    await dbHandle.close();
  }
}

if (process.env.ENVIRONMENT === "production") {
  console.error("Refusing to seed local users when ENVIRONMENT=production");
  process.exit(1);
}

await seedLocalUsers();
