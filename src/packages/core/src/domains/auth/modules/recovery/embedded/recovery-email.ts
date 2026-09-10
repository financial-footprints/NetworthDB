import {
  hashPassword,
  seedHashPassword,
  verifyPassword,
} from "@core/domains/auth/embedded/password";

let dummyRecoveryEmailHashPromise: Promise<string> | null = null;

function dummyRecoveryEmailHash(): Promise<string> {
  dummyRecoveryEmailHashPromise ??= seedHashPassword("__ndb_dummy_recovery__");
  return dummyRecoveryEmailHashPromise;
}

export async function hashRecoveryEmail(email: string): Promise<string> {
  return hashPassword(email.trim().toLowerCase());
}

export async function verifyRecoveryEmail(email: string, hash: string): Promise<boolean> {
  return verifyPassword(email.trim().toLowerCase(), hash);
}

export async function runDummyRecoveryEmailCheck(email: string): Promise<void> {
  const hash = await dummyRecoveryEmailHash();
  await verifyRecoveryEmail(email, hash);
}
