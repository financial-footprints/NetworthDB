import { describe, expect, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import { readApiData, readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

type CategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
};

describe("categories routes", () => {
  test("POST and GET categories", async () => {
    const { app } = await createTestApp({ username: "catapi", password: "password123" });
    const token = await loginViaApp(app, "catapi", "password123");

    const list = await app.request(API.categories.list, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const listed = await readApiJson<{ items: CategoryRow[] }>(list);
    expect(listed.items).toEqual([]);

    const create = await app.request(API.categories.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Custom", parentId: null }),
    });
    expect(create.status).toBe(201);
    const created = await readApiData<CategoryRow>(create);
    expect(created.name).toBe("Custom");
  });

  test("PATCH and DELETE category", async () => {
    const { app } = await createTestApp({ username: "catpatch", password: "password123" });
    const token = await loginViaApp(app, "catpatch", "password123");

    const create = await app.request(API.categories.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "To rename", parentId: null }),
    });
    const created = await readApiData<CategoryRow>(create);

    const patch = await app.request(apiPath(API.categories.patch, { categoryId: created.id }), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(patch.status).toBe(200);
    const updated = await readApiData<CategoryRow>(patch);
    expect(updated.name).toBe("Renamed");

    const del = await app.request(apiPath(API.categories.delete, { categoryId: created.id }), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);
  });

  test("PATCH unknown category returns 404", async () => {
    const { app } = await createTestApp({ username: "cat404", password: "password123" });
    const token = await loginViaApp(app, "cat404", "password123");

    const patch = await app.request(
      apiPath(API.categories.patch, { categoryId: crypto.randomUUID() }),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Nope" }),
      }
    );
    expect(patch.status).toBe(404);
  });

  test("POST child of child returns 400", async () => {
    const { app } = await createTestApp({ username: "catdepth", password: "password123" });
    const token = await loginViaApp(app, "catdepth", "password123");

    const parent = await readApiData<CategoryRow>(
      await app.request(API.categories.create, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Root", parentId: null }),
      })
    );
    const child = await readApiData<CategoryRow>(
      await app.request(API.categories.create, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Child", parentId: parent.id }),
      })
    );

    const grandchild = await app.request(API.categories.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Grandchild", parentId: child.id }),
    });
    expect(grandchild.status).toBe(400);
  });
});
