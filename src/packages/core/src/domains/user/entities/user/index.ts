import type { DisplayName } from "@core/domains/user/entities/user/display-name";
import { TotpState } from "@core/domains/user/entities/user/totp";
import type { Role } from "@core/domains/user/roles";
import { ValidationError } from "@core/shared/errors/domain-error";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;

export class Username {
  private constructor(private readonly value: string) {}

  static parse(raw: string): Username {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Username is required.", { field: "username" });
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
      throw new ValidationError("Username is invalid.", {
        field: "username",
        value: trimmed,
      });
    }

    return new Username(trimmed.toLowerCase());
  }

  static fromPersisted(raw: string): Username {
    return new Username(raw);
  }

  toString(): string {
    return this.value;
  }
}

export class User {
  constructor(
    public readonly id: string,
    public readonly username: Username,
    public readonly passwordHash: string,
    public readonly role: Role,
    public readonly multifactorEnabled: boolean,
    public readonly createdAt: Date,
    public readonly totp: TotpState = TotpState.empty(),
    public readonly recoveryEmailHash: string | null = null,
    public readonly recoveryEmailSetAt: Date | null = null,
    public readonly displayName: DisplayName | null = null
  ) {}

  hasRecoveryEmail(): boolean {
    return this.recoveryEmailHash !== null;
  }

  withUsername(username: Username): User {
    return new User(
      this.id,
      username,
      this.passwordHash,
      this.role,
      this.multifactorEnabled,
      this.createdAt,
      this.totp,
      this.recoveryEmailHash,
      this.recoveryEmailSetAt,
      this.displayName
    );
  }

  withRole(role: Role): User {
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      role,
      this.multifactorEnabled,
      this.createdAt,
      this.totp,
      this.recoveryEmailHash,
      this.recoveryEmailSetAt,
      this.displayName
    );
  }

  withPasswordHash(passwordHash: string): User {
    return new User(
      this.id,
      this.username,
      passwordHash,
      this.role,
      this.multifactorEnabled,
      this.createdAt,
      this.totp,
      this.recoveryEmailHash,
      this.recoveryEmailSetAt,
      this.displayName
    );
  }

  withMultifactorEnabled(multifactorEnabled: boolean): User {
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      this.role,
      multifactorEnabled,
      this.createdAt,
      this.totp,
      this.recoveryEmailHash,
      this.recoveryEmailSetAt,
      this.displayName
    );
  }

  withTotp(totp: TotpState): User {
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      this.role,
      this.multifactorEnabled,
      this.createdAt,
      totp,
      this.recoveryEmailHash,
      this.recoveryEmailSetAt,
      this.displayName
    );
  }

  withRecoveryEmail(hash: string, setAt: Date): User {
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      this.role,
      this.multifactorEnabled,
      this.createdAt,
      this.totp,
      hash,
      setAt,
      this.displayName
    );
  }

  clearRecoveryEmail(): User {
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      this.role,
      this.multifactorEnabled,
      this.createdAt,
      this.totp,
      null,
      null,
      this.displayName
    );
  }

  withDisplayName(displayName: DisplayName | null): User {
    return new User(
      this.id,
      this.username,
      this.passwordHash,
      this.role,
      this.multifactorEnabled,
      this.createdAt,
      this.totp,
      this.recoveryEmailHash,
      this.recoveryEmailSetAt,
      displayName
    );
  }
}
