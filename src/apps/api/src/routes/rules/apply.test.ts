import { describe, expect, test } from "bun:test";
import type { createApp } from "@ndb/api";
import { JobScope, Username } from "@ndb/core";
import { API, apiPath } from "@ndb/platform";
import {
  systemAccountId as idForSystemAccount,
  readApiData,
  readApiJson,
  readSystemAccountsData,
} from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { waitForJobInServices } from "@tests/api/helpers/wait-for-job";

async function systemAccountId(
  app: ReturnType<typeof createApp>,
  token: string,
  type: string
): Promise<string> {
  const response = await app.request(API.accounts.system.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await readSystemAccountsData(response);
  return idForSystemAccount(body.items, type);
}

async function createBankAccount(
  app: ReturnType<typeof createApp>,
  token: string
): Promise<string> {
  const response = await app.request(API.accounts.create, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bank: "HDFC",
      accountType: "bank",
      openingDate: "2020-01-01",
      accountNumber: "1111222233",
      passwords: [],
    }),
  });
  const body = await readApiData<{ id: string }>(response);
  return body.id;
}

async function createTxn(
  app: ReturnType<typeof createApp>,
  token: string,
  accountId: string,
  unknownId: string,
  description: string
): Promise<void> {
  const response = await app.request(apiPath(API.accounts.transactions.create, { accountId }), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date: "2024-06-01",
      amount: 100,
      sourceAccountId: accountId,
      destinationAccountId: unknownId,
      description,
    }),
  });
  expect(response.status).toBe(201);
}

describe("rules apply routes", () => {
  test("POST rule apply with word filter updates matching rows only", async () => {
    const { app, services } = await createTestApp({
      username: "rules_apply_word",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_apply_word", "password123");
    const accountId = await createBankAccount(app, token);
    const unknownId = await systemAccountId(app, token, "unknown");
    await createTxn(app, token, accountId, unknownId, "coffee shop");
    await createTxn(app, token, accountId, unknownId, "Tea House");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Apply group" }),
    });
    const group = await readApiData<{ id: string }>(groupRes);

    const ruleRes = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Tag",
        when: { op: "and", items: [{ type: "has_no_category" }] },
        actions: [{ type: "set_description", value: "Tagged" }],
      }),
    });
    const rule = await readApiData<{ id: string }>(ruleRes);

    const applyRes = await app.request(apiPath(API.rules.apply, { ruleId: rule.id }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "coffee" }),
    });
    expect(applyRes.status).toBe(202);
    const created = await readApiData<{ jobId: string }>(applyRes);
    await waitForJobInServices(services, "rules_apply_word", created.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const list = await app.request(
      `${apiPath(API.accounts.transactions.list, { accountId })}?from=2024-06-01&to=2024-06-30`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await readApiJson<{ items: { description: string }[] }>(list);
    const descriptions = body.items.map((item) => item.description);
    expect(descriptions).toContain("Tagged");
    expect(descriptions).toContain("Tea House");
  });

  test("POST group apply skips inactive child", async () => {
    const { app, services } = await createTestApp({
      username: "rules_apply_group",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_apply_group", "password123");
    const accountId = await createBankAccount(app, token);
    const unknownId = await systemAccountId(app, token, "unknown");
    await createTxn(app, token, accountId, unknownId, "groupchild row");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Group" }),
    });
    const group = await readApiData<{ id: string }>(groupRes);

    const inactiveRes = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Inactive",
        sortOrder: 0,
        when: { op: "and", items: [{ type: "description_contains", value: "groupchild" }] },
        actions: [{ type: "set_description", value: "Inactive hit" }],
      }),
    });
    const inactive = await readApiData<{ id: string }>(inactiveRes);
    await app.request(apiPath(API.rules.patch, { ruleId: inactive.id }), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: false }),
    });

    await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Active",
        sortOrder: 1,
        when: { op: "and", items: [{ type: "description_contains", value: "groupchild" }] },
        actions: [{ type: "append_description", value: " active" }],
      }),
    });

    const applyRes = await app.request(apiPath(API.ruleGroups.apply, { ruleGroupId: group.id }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(applyRes.status).toBe(202);
    const created = await readApiData<{ jobId: string }>(applyRes);
    await waitForJobInServices(services, "rules_apply_group", created.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const list = await app.request(
      `${apiPath(API.accounts.transactions.list, { accountId })}?from=2024-06-01&to=2024-06-30`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await readApiJson<{ items: { description: string }[] }>(list);
    expect(body.items.some((item) => item.description === "groupchild row active")).toBe(true);
    expect(body.items.some((item) => item.description === "Inactive hit")).toBe(false);
  });

  test("dry_run leaves ledger unchanged and sets output", async () => {
    const { app, services } = await createTestApp({
      username: "rules_apply_dry",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_apply_dry", "password123");
    const accountId = await createBankAccount(app, token);
    const unknownId = await systemAccountId(app, token, "unknown");
    await createTxn(app, token, accountId, unknownId, "dryrun row");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Dry" }),
    });
    const group = await readApiData<{ id: string }>(groupRes);

    const ruleRes = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Delete",
        when: { op: "and", items: [{ type: "description_contains", value: "dryrun" }] },
        actions: [{ type: "delete_transaction" }],
      }),
    });
    const rule = await readApiData<{ id: string }>(ruleRes);

    const applyRes = await app.request(apiPath(API.rules.apply, { ruleId: rule.id }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dryRun: true }),
    });
    const created = await readApiData<{ jobId: string }>(applyRes);
    await waitForJobInServices(services, "rules_apply_dry", created.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const user = (
      await services.users.findByFilters({ username: Username.parse("rules_apply_dry") })
    )[0];
    const job = await services.jobService.get(user, "aal1", created.jobId);
    expect(job.output.rules?.dryRun).toBe(true);
    expect(job.output.rules?.deleted).toBe(1);

    const list = await app.request(
      `${apiPath(API.accounts.transactions.list, { accountId })}?from=2024-06-01&to=2024-06-30`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await readApiJson<{ items: { description: string }[] }>(list);
    expect(body.items.some((item) => item.description === "dryrun row")).toBe(true);
  });

  test("second apply for same rule while first is active returns 409", async () => {
    const { app, services } = await createTestApp({
      username: "rules_apply_409",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_apply_409", "password123");
    const accountId = await createBankAccount(app, token);
    const unknownId = await systemAccountId(app, token, "unknown");
    await createTxn(app, token, accountId, unknownId, "hold row");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Conflict" }),
    });
    const group = await readApiData<{ id: string }>(groupRes);

    const ruleRes = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Slow",
        when: { op: "and", items: [{ type: "has_no_category" }] },
        actions: [{ type: "set_description", value: "Done" }],
      }),
    });
    const rule = await readApiData<{ id: string }>(ruleRes);

    const user = (
      await services.users.findByFilters({ username: Username.parse("rules_apply_409") })
    )[0];

    await services.jobRunnerService.submit(
      user.id,
      "rules_apply",
      JobScope.create({ ruleId: rule.id }),
      () => new Promise(() => {})
    );

    const second = await app.request(apiPath(API.rules.apply, { ruleId: rule.id }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(second.status).toBe(409);
  });

  test("unknown rule id returns 404", async () => {
    const { app } = await createTestApp({
      username: "rules_apply_404",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_apply_404", "password123");

    const response = await app.request(
      apiPath(API.rules.apply, { ruleId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    expect(response.status).toBe(404);
  });
});
