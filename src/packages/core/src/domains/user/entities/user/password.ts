import type { AppEnv } from "@core/domains/auth/constants";
import { ValidationError } from "@core/shared/errors/domain-error";

const DEV_MIN_PASSWORD_LEN = 8;
const PROD_MIN_PASSWORD_LEN = 12;
const MAX_PASSWORD_LEN = 128;

function hasUppercase(value: string): boolean {
  return /[A-Z]/.test(value);
}

function hasLowercase(value: string): boolean {
  return /[a-z]/.test(value);
}

function hasDigit(value: string): boolean {
  return /\d/.test(value);
}

function hasSymbol(value: string): boolean {
  return /[^A-Za-z0-9]/.test(value);
}

function meetsProductionComplexity(value: string): boolean {
  return hasUppercase(value) && hasLowercase(value) && hasDigit(value) && hasSymbol(value);
}

export class Password {
  private constructor(private readonly value: string) {}

  static parse(raw: string, appEnv: AppEnv): Password {
    const len = [...raw].length;
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

    if (appEnv === "production" && !meetsProductionComplexity(raw)) {
      throw new ValidationError("core.auth.password.invalid.complexity", { field: "password" });
    }

    return new Password(raw);
  }

  toString(): string {
    return this.value;
  }
}
