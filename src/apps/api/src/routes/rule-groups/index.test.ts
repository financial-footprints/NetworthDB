import { describe, expect, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import { readApiData, readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

type RuleGroupRow = {
  id: string;
  title: string;
  sortOrder: number;
  active: boolean;
};

function ruleGroupDetailsPath(id: string): string {
  return apiPath(API.ruleGroups.get, { ruleGroupId: id });
}

describe("rule-groups routes", () => {
  test("CRUD flow", async () => {
    const { app } = await createTestApp({ username: "rgapi", password: "password123" });
    const token = await loginViaApp(app, "rgapi", "password123");

    const listEmpty = await app.request(API.ruleGroups.list, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listEmpty.status).toBe(200);
    const listed = await readApiJson<{ items: RuleGroupRow[] }>(listEmpty);
    expect(listed.items).toEqual([]);

    const create = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Spend rules" }),
    });
    expect(create.status).toBe(201);
    const created = await readApiData<RuleGroupRow>(create);
    expect(created.title).toBe("Spend rules");

    const get = await app.request(ruleGroupDetailsPath(created.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(get.status).toBe(200);

    const patch = await app.request(ruleGroupDetailsPath(created.id), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Updated group", active: false }),
    });
    expect(patch.status).toBe(200);
    const patched = await readApiData<RuleGroupRow>(patch);
    expect(patched.title).toBe("Updated group");
    expect(patched.active).toBe(false);

    const del = await app.request(ruleGroupDetailsPath(created.id), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);

    const missing = await app.request(ruleGroupDetailsPath(created.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(missing.status).toBe(404);
  });

  test("create rejects empty title", async () => {
    const { app } = await createTestApp({ username: "rgbad", password: "password123" });
    const token = await loginViaApp(app, "rgbad", "password123");

    const create = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "   " }),
    });
    expect(create.status).toBe(400);
  });

  test("patch and delete return 404 for unknown id", async () => {
    const { app } = await createTestApp({ username: "rg404", password: "password123" });
    const token = await loginViaApp(app, "rg404", "password123");
    const id = crypto.randomUUID();

    const patch = await app.request(ruleGroupDetailsPath(id), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(patch.status).toBe(404);

    const del = await app.request(ruleGroupDetailsPath(id), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(404);
  });
});
