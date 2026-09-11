import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginViaApp } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";
import { waitForJobInServices } from "@tests/api/helpers/wait-for-job";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";
const STATEMENT_PDF = readFileSync(
  join(import.meta.dir, "../bruno/11 Jobs/fixtures/statement.pdf")
);

type BankListResponse = {
  items: Array<{ bank: string }>;
  total: number;
};

type AccountDetailsResponse = {
  account: { id: string };
  statements: { available: boolean };
};

type JobCreatedResponse = {
  id: string;
};

describe("account read routes", () => {
  test("GET /api/v1/accounts/banks returns OneCard", async () => {
    const services = await createAuthTestServices("banksuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "banksuser", "password123");

    const response = await app.request(API.accounts.banks, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<BankListResponse>(response);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
    expect(body.data.items.some((item) => item.bank === "onecard")).toBe(true);
  });

  test("GET /api/v1/accounts/:id/metadata returns empty metadata when no statements exist", async () => {
    const services = await createAuthTestServices("detailsuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "detailsuser", "password123");

    const createResponse = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "onecard",
        account_type: "credit_card",
        opening_date: "2020-01-15",
        account_number: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = await readApiJson<{ id: string }>(createResponse);

    const response = await app.request(API.accounts.metadata.replace(":id", created.data.id), {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<AccountDetailsResponse>(response);
    expect(body.data.account.id).toBe(created.data.id);
    expect(body.data.statements.available).toBe(false);
  });

  test("GET /api/v1/accounts/:id/files downloads uploaded pdf", async () => {
    const services = await createAuthTestServices("fileuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "fileuser", "password123");

    const createResponse = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "onecard",
        account_type: "credit_card",
        opening_date: "2020-01-15",
        account_number: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = await readApiJson<{ id: string }>(createResponse);

    const form = new FormData();
    form.set("account_id", created.data.id);
    form.set("format", "pdf");
    form.set("covered_month", "2024-01");
    form.set("file", new File([STATEMENT_PDF], "statement.pdf", { type: "application/pdf" }));

    const uploadResponse = await app.request(API.accounts.files.upload, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(uploadResponse.status).toBe(202);
    const upload = await readApiJson<JobCreatedResponse>(uploadResponse);
    const uploadJob = await waitForJobInServices(services, "fileuser", upload.data.id, {
      wantStatus: "completed",
    });
    expect(uploadJob.status).toBe("completed");

    const downloadUrl = `${API.accounts.files.download.replace(":id", created.data.id)}?statement_date=2024-01&format=pdf`;
    const response = await app.request(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array(STATEMENT_PDF));
  });
});
