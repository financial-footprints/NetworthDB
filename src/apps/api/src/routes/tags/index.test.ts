import { describe, expect, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import { readApiData, readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

type TagRow = { id: string; name: string };

describe("tags routes", () => {
  test("POST and GET tags", async () => {
    const { app } = await createTestApp({ username: "tagapi", password: "password123" });
    const token = await loginViaApp(app, "tagapi", "password123");

    const create = await app.request(API.tags.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Reimbursable" }),
    });
    expect(create.status).toBe(201);

    const list = await app.request(API.tags.list, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = await readApiJson<{ items: TagRow[] }>(list);
    expect(body.items.some((row) => row.name === "Reimbursable")).toBe(true);
  });

  test("PATCH and DELETE tag", async () => {
    const { app } = await createTestApp({ username: "tagpatch", password: "password123" });
    const token = await loginViaApp(app, "tagpatch", "password123");

    const create = await app.request(API.tags.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Mutable" }),
    });
    const created = await readApiData<TagRow>(create);

    const patch = await app.request(apiPath(API.tags.patch, { tagId: created.id }), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Mutable renamed" }),
    });
    expect(patch.status).toBe(200);
    const updated = await readApiData<TagRow>(patch);
    expect(updated.name).toBe("Mutable renamed");

    const del = await app.request(apiPath(API.tags.delete, { tagId: created.id }), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);
  });
});
