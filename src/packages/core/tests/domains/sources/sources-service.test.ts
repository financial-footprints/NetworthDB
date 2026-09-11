import { beforeAll, describe, expect, test } from "bun:test";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { UnauthorizedError } from "@core/shared/errors/domain-error";
import { InMemorySourcesRepository } from "@tests/core/fakes/in-memory-sources-repository";
import { InMemoryUserRepository } from "@tests/core/fakes/in-memory-user-repository";

describe("SourcesService", () => {
  let mfaActor: User;
  let service: SourcesService;

  beforeAll(async () => {
    const users = new InMemoryUserRepository();
    const passwordHash = "stub-password-hash";

    const mfaUser = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("mfauser"),
        passwordHash,
        "user",
        true,
        new Date()
      )
    );

    mfaActor = mfaUser;
    service = new SourcesService(new InMemorySourcesRepository());
  });

  test("requires AAL2 when MFA is enabled", async () => {
    await expect(service.getSources(mfaActor, "aal1")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
