import type { AppEnv } from "@core/domains/auth/constants";
import { hashPassword, validatePassword } from "@core/domains/auth/embedded/password";
import { assertAal2 } from "@core/domains/auth/helpers";
import { PublicUser } from "@core/domains/user/entities/public-user";
import { User, Username } from "@core/domains/user/entities/user/index";
import {
  assertAdministrator,
  assertAdministratorOrManager,
  parseRole,
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

export type RegisterUserInput = {
  username: string;
  password: string;
  role?: string;
};

export type UpdateUserInput = {
  username?: string;
  role?: string;
};

export type SessionRevoker = {
  revoke(userId: string): Promise<void>;
};

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: SessionRevoker,
    private readonly appEnv: AppEnv
  ) {}

  private async _get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new EntityNotFoundError("core.user.find.not-found", {
        entityName: "User",
        id: userId,
      });
    }

    return user;
  }

  private async _applyUpdates(
    actor: PublicUser,
    user: User,
    userId: string,
    input: UpdateUserInput
  ): Promise<User> {
    let updated = user;

    if (input.role !== undefined) {
      updated = this._applyRole(actor, user, userId, input.role, updated);
    }

    if (input.username !== undefined) {
      updated = await this._applyUsername(user, userId, input.username, updated);
    }

    return updated;
  }

  private _applyRole(
    actor: PublicUser,
    user: User,
    userId: string,
    role: string,
    updated: User
  ): User {
    const parsedRole = parseRole(role);
    if (actor.id === userId) {
      throw new ValidationError("core.user.role.invalid.self-change");
    }

    return parsedRole === user.role ? updated : updated.withRole(parsedRole);
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
      throw new ConflictError("core.user.username.conflict.taken", {
        username: parsedUsername.toString(),
      });
    }

    return updated.withUsername(parsedUsername);
  }

  async register(
    actor: PublicUser,
    authAcr: string,
    input: RegisterUserInput
  ): Promise<PublicUser> {
    assertAdministrator(actor);
    assertAal2(actor.multifactorEnabled, authAcr);

    const username = Username.parse(input.username);
    validatePassword(input.password, this.appEnv);
    const role: Role = input.role === undefined ? "user" : parseRole(input.role);

    const existing = await findFirst(this.users.findByFilters.bind(this.users), { username });
    if (existing) {
      throw new ConflictError("core.user.username.conflict.taken", {
        username: username.toString(),
      });
    }

    const user = new User(
      crypto.randomUUID(),
      username,
      await hashPassword(input.password),
      role,
      false,
      new Date()
    );
    const created = await this.users.create(user);
    return PublicUser.fromUser(created);
  }

  async list(actor: PublicUser, authAcr: string, query: UserListQuery): Promise<UserListResult> {
    assertAdministratorOrManager(actor);
    assertAal2(actor.multifactorEnabled, authAcr);

    const filters: UserFilters = {
      role: query.role,
      multifactorEnabled: query.multifactorEnabled,
      search: query.search,
    };
    const total = await this.users.aggregate(filters);
    const items = await this.users.findByFilters(
      filters,
      { column: "username", direction: "asc" },
      { limit: query.limit, offset: query.offset }
    );
    return {
      items: items.map((user) => PublicUser.fromUser(user)),
      total,
    };
  }

  async update(
    actor: PublicUser,
    authAcr: string,
    userId: string,
    input: UpdateUserInput
  ): Promise<PublicUser> {
    assertAdministrator(actor);
    assertAal2(actor.multifactorEnabled, authAcr);

    if (input.username === undefined && input.role === undefined) {
      throw new ValidationError("core.user.patch.invalid.no-fields");
    }

    const user = await this._get(userId);
    const updated = await this._applyUpdates(actor, user, userId, input);

    if (updated === user) {
      return PublicUser.fromUser(user);
    }

    const saved = await this.users.save(updated);
    await this.auth.revoke(userId);
    return PublicUser.fromUser(saved);
  }

  async delete(actor: PublicUser, authAcr: string, userId: string): Promise<void> {
    assertAdministrator(actor);
    assertAal2(actor.multifactorEnabled, authAcr);

    if (actor.id === userId) {
      throw new ValidationError("core.user.delete.invalid.self-delete");
    }

    await this._get(userId);
    await this.auth.revoke(userId);
    await this.users.delete({ id: userId });
  }
}
