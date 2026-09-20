import { ValidationError } from "@core/shared/errors/domain-error";

const MAX_DISPLAY_NAME_LEN = 2100;

export class DisplayName {
  private constructor(private readonly value: string) {}

  static parse(raw: string): DisplayName {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Display name is required.", {
        field: "display_name",
      });
    }

    if (trimmed.length > MAX_DISPLAY_NAME_LEN) {
      throw new ValidationError("Display name is too long.", {
        field: "display_name",
      });
    }

    return new DisplayName(trimmed);
  }

  static parseOptional(raw?: string | null): DisplayName | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }

    return DisplayName.parse(trimmed);
  }

  static fromPersisted(raw: string): DisplayName {
    return new DisplayName(raw);
  }

  toString(): string {
    return this.value;
  }
}
