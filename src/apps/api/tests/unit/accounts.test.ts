import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginViaApp } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";

type AccountResponse = {
  id: string;
  label: string;
  account_type: string;
  bank: string;
  has_passwords: boolean;
};

type AccountListResponse = {
  items: AccountResponse[];
  total: number;
};

describe("accounts routes", () => {
  test("POST /api/v1/accounts creates an account", async () => {
    const services = await createAuthTestServices("acctuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "acctuser", "password123");

    const response = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "HDFC",
        variant: "Regalia",
        account_type: "credit_card",
        opening_date: "2020-01-15",
        account_number: ACCOUNT_NUMBER_SAMPLE,
        passwords: ["secret"],
      }),
    });

    expect(response.status).toBe(201);
    const body = await readApiJson<AccountResponse>(response);
    expect(body.data.bank).toBe("HDFC");
    expect(body.data.account_type).toBe("credit_card");
    expect(body.data.has_passwords).toBe(true);
  });

  test("GET /api/v1/accounts lists accounts with optional filter", async () => {
    const services = await createAuthTestServices("listuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "listuser", "password123");

    await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "ICICI",
        account_type: "bank_account",
        opening_date: "2019-01-01",
        account_number: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });

    const list = await app.request(`${API.accounts.list}?account_type=bank_account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = await readApiJson<AccountListResponse>(list);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
    expect(body.data.items.every((item) => item.account_type === "bank_account")).toBe(true);
  });

  test("PATCH and DELETE /api/v1/accounts/:id", async () => {
    const services = await createAuthTestServices("patchuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "patchuser", "password123");

    const create = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "PNB",
        account_type: "credit_card",
        opening_date: "2021-05-01",
        account_number: ACCOUNT_NUMBER_SAMPLE,
        passwords: ["one"],
      }),
    });
    const created = await readApiJson<AccountResponse>(create);

    const patch = await app.request(API.accounts.details.replace(":id", created.data.id), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "PNB One",
      }),
    });
    expect(patch.status).toBe(200);
    const patched = await readApiJson<AccountResponse>(patch);
    expect(patched.data.bank).toBe("PNB One");

    const del = await app.request(API.accounts.details.replace(":id", created.data.id), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);
  });

  test("GET /api/v1/accounts requires authentication", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.accounts.list);
    expect(response.status).toBe(401);
  });
});
