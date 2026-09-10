import { beforeAll, describe, expect, test } from "bun:test";
import { hashPassword } from "@core/domains/auth/embedded/password";
import { PublicUser } from "@core/domains/user/entities/public-user";
import { User, Username } from "@core/domains/user/entities/user/index";
import { UserService } from "@core/domains/user/services/user-service";
import { ForbiddenError, ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryUserRepository } from "@tests/core/fakes/in-memory-user-repository";

describe("UserService admin account edits", () => {
  let passwordHash = "";
  let adminUser: PublicUser;
  let managerUser: PublicUser;
  let regularUser: PublicUser;
  let service: UserService;
  let users: InMemoryUserRepository;

  beforeAll(async () => {
    passwordHash = await hashPassword("password123");
    users = new InMemoryUserRepository();
    service = new UserService(users, { revoke: async () => undefined }, "local");

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

    adminUser = PublicUser.fromUser(admin);
    managerUser = PublicUser.fromUser(manager);
    regularUser = PublicUser.fromUser(user);
  });

  test("register creates a user for administrators", async () => {
    const created = await service.register(adminUser, "aal1", {
      username: "bob",
      password: "password123",
    });

    expect(created.username).toBe("bob");
    expect(created.role).toBe("user");
  });

  test("register rejects non-administrators", async () => {
    await expect(
      service.register(regularUser, "aal1", {
        username: "carol",
        password: "password123",
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
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
    const target = await service.register(adminUser, "aal1", {
      username: "delete_me",
      password: "password123",
    });

    await service.delete(adminUser, "aal1", target.id);
    expect(await users.findById(target.id)).toBeNull();
  });
});
