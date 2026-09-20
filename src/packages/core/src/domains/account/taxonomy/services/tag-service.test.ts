import { beforeAll, describe, expect, test } from "bun:test";
import { TagService } from "@core/domains/account/taxonomy/services/tag-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { InMemoryTagRepository } from "@core/tests/fakes/in-memory-tag-repository";

const AAL2 = "aal2";

describe("TagService", () => {
  let user: User;
  let service: TagService;

  beforeAll(() => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("tag_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    service = new TagService(new InMemoryTagRepository());
  });

  test("create list update delete", async () => {
    const created = await service.create(user, AAL2, { name: "Travel" });
    const list = await service.list(user, AAL2, { limit: 10, offset: 0 });
    expect(list.items.some((row) => row.id === created.id)).toBe(true);
    const updated = await service.update(user, AAL2, created.id, { name: "Trips" });
    expect(updated.name).toBe("Trips");
    await service.delete(user, AAL2, created.id);
    const after = await service.list(user, AAL2, { limit: 10, offset: 0 });
    expect(after.items.some((row) => row.id === created.id)).toBe(false);
  });
});
