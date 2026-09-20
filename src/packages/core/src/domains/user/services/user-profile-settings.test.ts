import { describe, expect, test } from "bun:test";
import { ClientSettings } from "@core/domains/user/entities/user/client-settings";
import { DisplayName } from "@core/domains/user/entities/user/display-name";
import { User, Username } from "@core/domains/user/entities/user/index";
import { UserService } from "@core/domains/user/services/user-service";
import { ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryUserRepository } from "@core/tests/fakes/in-memory-user-repository";

describe("UserService profile fields", () => {
  test("updateDisplayName does not require a vault", async () => {
    const users = new InMemoryUserRepository();
    const service = new UserService(users, { revoke: async () => {} });
    const user = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("profileuser"),
        "hash",
        "user",
        false,
        new Date()
      )
    );

    await service.updateDisplayName(user.id, "Plain Name");
    const updated = await users.findById(user.id);
    expect(updated?.displayName?.toString()).toBe("Plain Name");
  });

  test("saveClientSettings round-trips opaque JSON", async () => {
    const users = new InMemoryUserRepository();
    const service = new UserService(users, { revoke: async () => {} });
    const user = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("settingsuser"),
        "hash",
        "user",
        false,
        new Date()
      )
    );

    const saved = await service.saveClientSettings(user.id, {
      e2ee: { display_name: false },
    });
    expect(saved).toEqual({ e2ee: { display_name: false } });

    const loaded = await service.getClientSettings(user.id);
    expect(loaded).toEqual({ e2ee: { display_name: false } });
  });

  test("restoreBackupProfile overwrites display name and settings", async () => {
    const users = new InMemoryUserRepository();
    const service = new UserService(users, { revoke: async () => {} });
    const user = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("restoreprofile"),
        "hash",
        "user",
        false,
        new Date()
      )
    );
    await service.updateDisplayName(user.id, "Before");

    await service.restoreBackupProfile(user.id, "abc.def", {
      e2ee: { display_name: true, account_number: false },
    });

    const updated = await users.findById(user.id);
    expect(updated?.displayName?.toString()).toBe("abc.def");
    expect(await service.getClientSettings(user.id)).toEqual({
      e2ee: { display_name: true, account_number: false },
    });
  });
});

describe("ClientSettings", () => {
  test("rejects payloads that are too large", () => {
    const huge = { key: "x".repeat(9000) };
    expect(() => ClientSettings.parse(huge)).toThrow(ValidationError);
  });

  test("DisplayName accepts opaque blobs", () => {
    expect(DisplayName.parse("abc.def").toString()).toBe("abc.def");
  });
});
