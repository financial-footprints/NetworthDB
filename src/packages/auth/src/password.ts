import type { PasswordHasher } from "@ndb/core";
import { DomainError } from "@ndb/core";
import { Algorithm, hash, verify } from "@node-rs/argon2";

const ARGON_MEMORY_KIB = 65_536;
const ARGON_TIME_COST = 2;
const ARGON_PARALLELISM = 4;
const ARGON_OUTPUT_LEN = 32;

const SEED_SALT = Buffer.alloc(16, 0);

const ARGON_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: ARGON_MEMORY_KIB,
  timeCost: ARGON_TIME_COST,
  parallelism: ARGON_PARALLELISM,
  outputLen: ARGON_OUTPUT_LEN,
} as const;

export function createPasswordHasher(): PasswordHasher {
  return {
    async hash(password: string): Promise<string> {
      try {
        return await hash(password, ARGON_OPTIONS);
      } catch (cause) {
        throw new DomainError("core.auth.password.hash.error.failed", {
          code: "internal",
          cause: cause instanceof Error ? cause : undefined,
        });
      }
    },

    async verify(password: string, passwordHash: string): Promise<boolean> {
      try {
        return await verify(passwordHash, password);
      } catch {
        return false;
      }
    },
  };
}

export async function seedHashPassword(password: string): Promise<string> {
  try {
    return await hash(password, { ...ARGON_OPTIONS, salt: SEED_SALT });
  } catch (cause) {
    throw new DomainError("core.auth.password.hash.error.failed", {
      code: "internal",
      cause: cause instanceof Error ? cause : undefined,
    });
  }
}
