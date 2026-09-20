import { describe, expect, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import { readApiData, readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

type RuleGroupRow = { id: string; title: string };
type RuleRow = { id: string; title: string; groupId: string };

function ruleDetailsPath(id: string): string {
  return apiPath(API.rules.get, { ruleId: id });
}

describe("rules routes", () => {
  test("CRUD flow with group", async () => {
    const { app } = await createTestApp({ username: "ruleapi", password: "password123" });
    const token = await loginViaApp(app, "ruleapi", "password123");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Group" }),
    });
    const group = await readApiData<RuleGroupRow>(groupRes);
    const groupId = group.id;

    const create = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: groupId,
        title: "Coffee",
        when: { op: "and", items: [{ type: "description_contains", value: "coffee" }] },
        actions: [{ type: "clear_category" }],
      }),
    });
    expect(create.status).toBe(201);
    const created = await readApiData<RuleRow>(create);
    expect(created.groupId).toBe(groupId);

    const list = await app.request(`${API.rules.list}?groupId=${groupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const listed = await readApiJson<{ items: RuleRow[] }>(list);
    expect(listed.items).toHaveLength(1);

    const get = await app.request(ruleDetailsPath(created.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(get.status).toBe(200);

    const patch = await app.request(ruleDetailsPath(created.id), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Tea instead" }),
    });
    expect(patch.status).toBe(200);

    const del = await app.request(ruleDetailsPath(created.id), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);
  });

  test("list without groupId returns 400", async () => {
    const { app } = await createTestApp({
      username: "rulelist",
      password: "password123",
    });
    const token = await loginViaApp(app, "rulelist", "password123");

    const list = await app.request(API.rules.list, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(400);
  });

  test("create with missing group returns 404", async () => {
    const { app } = await createTestApp({
      username: "rule404g",
      password: "password123",
    });
    const token = await loginViaApp(app, "rule404g", "password123");

    const create = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: crypto.randomUUID(),
        title: "Orphan",
        when: { op: "and", items: [{ type: "has_no_category" }] },
        actions: [{ type: "clear_category" }],
      }),
    });
    expect(create.status).toBe(404);
  });

  test("unknown trigger type returns 400", async () => {
    const { app } = await createTestApp({ username: "rulebad", password: "password123" });
    const token = await loginViaApp(app, "rulebad", "password123");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "G" }),
    });
    const group = await readApiData<RuleGroupRow>(groupRes);

    const create = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Bad",
        when: { op: "and", items: [{ type: "not_a_real_trigger", value: "x" }] },
        actions: [{ type: "clear_category" }],
      }),
    });
    expect(create.status).toBe(400);
  });
});
