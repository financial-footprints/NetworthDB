import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { users } from "@database/schema/users/index";
import { seedHashPassword } from "@ndb/core";

const SEED_USERS = [
  { id: "00000000-0000-4000-8000-000000000001", username: "admin", role: "administrator" },
  { id: "00000000-0000-4000-8000-000000000002", username: "manasi", role: "manager" },
  { id: "00000000-0000-4000-8000-000000000003", username: "usher", role: "user" },
] as const;

function resetUserState(passwordHash: string, role: string) {
  return {
    passwordHash,
    role,
    multifactorEnabled: false,
    multifactorFailedCount: 0,
    multifactorLockedUntil: null,
    totpConfirmedAt: null,
    totpSecretCiphertext: null,
    totpSecretNonce: null,
    totpPendingCiphertext: null,
    totpPendingNonce: null,
    totpLastStep: null,
    recoveryEmailHash: null,
    recoveryEmailSetAt: null,
    e2eeName: null,
  };
}

async function seedLocalUsers(): Promise<void> {
  const passwordHash = await seedHashPassword("admin");
  const dbHandle = createDbClient({ config: parseDbEnv() });
  const createdAt = new Date();

  try {
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
