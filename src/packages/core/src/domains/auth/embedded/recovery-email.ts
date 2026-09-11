import type { PasswordHasher } from "@core/ports/auth";

let dummyRecoveryEmailHashPromise: Promise<string> | null = null;

function dummyRecoveryEmailHash(password: PasswordHasher): Promise<string> {
  dummyRecoveryEmailHashPromise ??= password.hash("__ndb_dummy_recovery__");
  return dummyRecoveryEmailHashPromise;
}

export async function hashRecoveryEmail(password: PasswordHasher, email: string): Promise<string> {
  return password.hash(email.trim().toLowerCase());
}

export async function verifyRecoveryEmail(
  password: PasswordHasher,
  email: string,
  hash: string
): Promise<boolean> {
  return password.verify(email.trim().toLowerCase(), hash);
}

export async function runDummyRecoveryEmailCheck(
  password: PasswordHasher,
  email: string
): Promise<void> {
  const hash = await dummyRecoveryEmailHash(password);
  await verifyRecoveryEmail(password, email, hash);
}
