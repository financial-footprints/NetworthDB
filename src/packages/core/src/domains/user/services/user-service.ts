import { assertAal2 } from "@core/domains/auth/helpers";
import { ClientSettings } from "@core/domains/user/entities/user/client-settings";
import { DisplayName } from "@core/domains/user/entities/user/display-name";
import { type User, Username } from "@core/domains/user/entities/user/index";
import {
  assertAdministrator,
  assertAdministratorOrManager,
  type Role,
  type UserListQuery,
  type UserListResult,
} from "@core/domains/user/helpers";
import type { UserFilters, UserRepository } from "@core/domains/user/repositories/user-repository";
import {
  ConflictError,
  EntityNotFoundError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";

export type UpdateUserInput = {
  username?: string;
  role?: Role;
};

export type SessionRevoker = {
  revoke(userId: string): Promise<void>;
};

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: SessionRevoker
  ) {}

  private async _get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new EntityNotFoundError("User", userId);
    }

    return user;
  }

  private async _applyUpdates(
    caller: User,
    user: User,
    userId: string,
    input: UpdateUserInput
  ): Promise<User> {
    let updated = user;

    if (input.role !== undefined) {
      updated = this._applyRole(caller, user, userId, input.role, updated);
    }

    if (input.username !== undefined) {
      updated = await this._applyUsername(user, userId, input.username, updated);
    }

    return updated;
  }

  private _applyRole(caller: User, user: User, userId: string, role: Role, updated: User): User {
    if (caller.id === userId) {
      throw new ValidationError("You cannot change your own role.");
    }

    return role === user.role ? updated : updated.withRole(role);
  }

  private async _applyUsername(
    user: User,
    userId: string,
    username: string,
    updated: User
  ): Promise<User> {
    const parsedUsername = Username.parse(username);
    if (parsedUsername.toString() === user.username.toString()) {
      return updated;
    }

    const taken = await findFirst(this.users.findByFilters.bind(this.users), {
      username: parsedUsername,
    });
    if (taken && taken.id !== userId) {
      throw new ConflictError("Username is already taken.", {
        username: parsedUsername.toString(),
      });
    }

    return updated.withUsername(parsedUsername);
  }

  async list(user: User, authAcr: string, query: UserListQuery): Promise<UserListResult> {
    assertAdministratorOrManager(user);
    assertAal2(user.multifactorEnabled, authAcr);

    const filters: UserFilters = {
      role: query.role,
      multifactorEnabled: query.multifactorEnabled,
      search: query.search,
    };
    const [total, items] = await Promise.all([
      this.users.aggregate(filters),
      this.users.findByFilters(
        filters,
        { column: "username", direction: "asc" },
        { limit: query.limit, offset: query.offset }
      ),
    ]);
    return { items, total };
  }

  async update(
    caller: User,
    authAcr: string,
    userId: string,
    input: UpdateUserInput
  ): Promise<User> {
    assertAdministrator(caller);
    assertAal2(caller.multifactorEnabled, authAcr);

    if (input.username === undefined && input.role === undefined) {
      throw new ValidationError("No fields to update.");
    }

    const user = await this._get(userId);
    const updated = await this._applyUpdates(caller, user, userId, input);

    if (updated === user) {
      return user;
    }

    const saved = await this.users.save(updated);
    await this.auth.revoke(userId);
    return saved;
  }

  async delete(user: User, authAcr: string, userId: string): Promise<void> {
    assertAdministrator(user);
    assertAal2(user.multifactorEnabled, authAcr);

    if (user.id === userId) {
      throw new ValidationError("You cannot delete your own account.");
    }

    await this._get(userId);
    await this.auth.revoke(userId);
    await this.users.delete({ id: userId });
  }

  async updateDisplayName(userId: string, raw: string): Promise<void> {
    const user = await this._get(userId);
    const displayName = DisplayName.parse(raw);
    await this.users.save(user.withDisplayName(displayName));
  }

  async getClientSettings(userId: string): Promise<Record<string, unknown> | null> {
    await this._get(userId);
    return this.users.getClientSettings(userId);
  }

  async saveClientSettings(userId: string, raw: unknown): Promise<Record<string, unknown> | null> {
    await this._get(userId);
    if (raw === null) {
      return this.users.saveClientSettings(userId, null);
    }
    const parsed = ClientSettings.parse(raw);
    return this.users.saveClientSettings(userId, parsed.toJson());
  }

  async restoreBackupProfile(
    userId: string,
    displayName: string | null,
    clientSettings: unknown
  ): Promise<void> {
    const user = await this._get(userId);
    if (displayName === null || displayName === "") {
      await this.users.save(user.withDisplayName(null));
    } else if (displayName.length > 2100) {
      throw new ValidationError("Display name is too long.", {
        field: "displayName",
      });
    } else {
      await this.users.save(user.withDisplayName(DisplayName.fromPersisted(displayName)));
    }

    await this.saveClientSettings(userId, clientSettings);
  }
}
