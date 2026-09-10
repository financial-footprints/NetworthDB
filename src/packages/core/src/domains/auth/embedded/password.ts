import type { AppEnv } from "@core/domains/auth/constants";
import { DomainError, ValidationError } from "@core/shared/errors/domain-error";
import { Algorithm, hash, verify } from "@node-rs/argon2";
import PasswordValidator from "password-validator";

const DEV_MIN_PASSWORD_LEN = 8;
const PROD_MIN_PASSWORD_LEN = 12;
const MAX_PASSWORD_LEN = 128;

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

const PROD_COMPLEXITY = new PasswordValidator()
  .has()
  .uppercase()
  .has()
  .lowercase()
  .has()
  .digits()
  .has()
  .symbols();

export function validatePassword(password: string, appEnv: AppEnv): void {
  const len = [...password].length;
  const minLen = appEnv === "production" ? PROD_MIN_PASSWORD_LEN : DEV_MIN_PASSWORD_LEN;

  if (len < minLen) {
    throw new ValidationError(`core.auth.password.invalid.too-short.${minLen}`, {
      field: "password",
    });
  }

  if (len > MAX_PASSWORD_LEN) {
    throw new ValidationError(`core.auth.password.invalid.too-long.${MAX_PASSWORD_LEN}`, {
      field: "password",
    });
  }

  if (appEnv === "production") {
    validateProductionComplexity(password);
  }
}

function validateProductionComplexity(password: string): void {
  if (!PROD_COMPLEXITY.validate(password)) {
    throw new ValidationError("core.auth.password.invalid.complexity", { field: "password" });
  }
}

export async function hashPassword(password: string): Promise<string> {
  try {
    return await hash(password, ARGON_OPTIONS);
  } catch (cause) {
    throw new DomainError("core.auth.password.hash.error.failed", {
      code: "internal",
      cause: cause instanceof Error ? cause : undefined,
    });
  }
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

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
