import { beforeAll, describe, expect, test } from "bun:test";
import { CategoryService } from "@core/domains/account/taxonomy/services/category-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryCategoryRepository } from "@core/tests/fakes/in-memory-category-repository";

const AAL2 = "aal2";

describe("CategoryService", () => {
  let user: User;
  let service: CategoryService;

  beforeAll(() => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("category_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    service = new CategoryService(new InMemoryCategoryRepository());
  });

  test("ensureDefaultCategories seeds once", async () => {
    await service.ensureDefaultCategories(user.id);
    const first = await service.list(user, AAL2, { limit: 50, offset: 0 });
    expect(first.total).toBeGreaterThan(0);
    await service.ensureDefaultCategories(user.id);
    const second = await service.list(user, AAL2, { limit: 50, offset: 0 });
    expect(second.total).toBe(first.total);
  });

  test("rejects child of child", async () => {
    const parent = await service.create(user, AAL2, { name: "Parent", parentId: null });
    const child = await service.create(user, AAL2, {
      name: "Child",
      parentId: parent.id,
    });
    await expect(
      service.create(user, AAL2, { name: "Grandchild", parentId: child.id })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("update renames category", async () => {
    const row = await service.create(user, AAL2, { name: "Before", parentId: null });
    const updated = await service.update(user, AAL2, row.id, { name: "After" });
    expect(updated.name).toBe("After");
  });

  test("create with missing parent id throws", async () => {
    await expect(
      service.create(user, AAL2, { name: "Orphan", parentId: crypto.randomUUID() })
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  test("delete unknown category throws", async () => {
    await expect(service.delete(user, AAL2, crypto.randomUUID())).rejects.toBeInstanceOf(
      EntityNotFoundError
    );
  });
});
