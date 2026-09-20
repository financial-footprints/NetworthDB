import { beforeAll, describe, expect, test } from "bun:test";
import { User, Username } from "@core/domains/user/entities/user/index";
import { UserService } from "@core/domains/user/services/user-service";
import { ForbiddenError, ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryUserRepository } from "@core/tests/fakes/in-memory-user-repository";

describe("UserService admin account edits", () => {
  let passwordHash = "";
  let adminUser: User;
  let managerUser: User;
  let regularUser: User;
  let service: UserService;
  let users: InMemoryUserRepository;

  beforeAll(async () => {
    passwordHash = "stub-password-hash";
    users = new InMemoryUserRepository();
    service = new UserService(users, { revoke: async () => undefined });

    const admin = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("admin"),
        passwordHash,
        "administrator",
        false,
        new Date()
      )
    );
    const manager = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("manager"),
        passwordHash,
        "manager",
        false,
        new Date()
      )
    );
    const user = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("alice"),
        passwordHash,
        "user",
        false,
        new Date()
      )
    );

    adminUser = admin;
    managerUser = manager;
    regularUser = user;
  });

  test("listUsers allows managers", async () => {
    const result = await service.list(managerUser, "aal1", { limit: 100, offset: 0 });
    expect(result.total).toBeGreaterThanOrEqual(3);
  });

  test("listUsers rejects regular users", async () => {
    await expect(
      service.list(regularUser, "aal1", { limit: 100, offset: 0 })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("updateUser rejects self role change", async () => {
    await expect(
      service.update(adminUser, "aal1", adminUser.id, { role: "user" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("deleteUser rejects self-delete", async () => {
    await expect(service.delete(adminUser, "aal1", adminUser.id)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  test("deleteUser removes another user", async () => {
    const target = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("delete_me"),
        passwordHash,
        "user",
        false,
        new Date()
      )
    );

    await service.delete(adminUser, "aal1", target.id);
    expect(await users.findById(target.id)).toBeNull();
  });
});
