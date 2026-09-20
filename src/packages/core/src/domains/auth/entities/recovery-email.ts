import { ValidationError } from "@core/shared/errors/domain-error";

export class RecoveryEmail {
  private constructor(private readonly value: string) {}

  static parse(raw: string): RecoveryEmail {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Email is required.", { field: "email" });
    }

    if (trimmed.length > 254) {
      throw new ValidationError("Email is too long.", { field: "email" });
    }

    const at = trimmed.indexOf("@");
    if (at <= 0 || at === trimmed.length - 1 || trimmed.includes(" ")) {
      throw new ValidationError("Email is invalid.", { field: "email" });
    }

    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    if (local.length === 0 || domain.length === 0 || !domain.includes(".")) {
      throw new ValidationError("Email is invalid.", { field: "email" });
    }

    return new RecoveryEmail(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
