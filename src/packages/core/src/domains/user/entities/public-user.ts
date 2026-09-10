import type { User } from "@core/domains/user/entities/user/index";
import type { Role } from "@core/domains/user/helpers";

export class PublicUser {
  constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly role: Role,
    public readonly multifactorEnabled: boolean,
    public readonly createdAt: Date,
    public readonly multifactorMethods: string[],
    public readonly recoveryCodesEnabled: boolean = false,
    public readonly recoveryEmailEnabled: boolean = false,
    public readonly recoveryEmailSetAt: Date | null = null
  ) {}

  static fromUser(
    user: User,
    multifactorMethods: string[] = [],
    recoveryCodesEnabled = false
  ): PublicUser {
    const methods =
      multifactorMethods.length > 0 ? multifactorMethods : user.totp.hasTotp() ? ["totp"] : [];

    return new PublicUser(
      user.id,
      user.username.toString(),
      user.role,
      user.multifactorEnabled,
      user.createdAt,
      methods,
      recoveryCodesEnabled,
      user.hasRecoveryEmail(),
      user.recoveryEmailSetAt
    );
  }
}
