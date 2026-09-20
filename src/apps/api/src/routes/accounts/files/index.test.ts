import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { waitForJobInServices } from "@tests/api/helpers/wait-for-job";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";
const STATEMENT_PDF = readFileSync(
  join(import.meta.dir, "../../../../tests/bruno/11 Jobs/fixtures/statement.pdf")
);

type JobCreatedResponse = {
  data: {
    jobId: string;
  };
};

describe("upload routes", () => {
  test("POST /api/v1/accounts/files/upload enqueues job", async () => {
    const { app, services } = await createTestApp({
      username: "uploaduser",
      password: "password123",
    });
    const token = await loginViaApp(app, "uploaduser", "password123");

    const createResponse = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "onecard",
        accountType: "credit_card",
        openingDate: "2020-01-15",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = await readApiJson<{ data: { id: string } }>(createResponse);

    const form = new FormData();
    form.set("account_id", created.data.id);
    form.set("format", "pdf");
    form.set("covered_month", "2024-01");
    form.set("file", new File([STATEMENT_PDF], "statement.pdf", { type: "application/pdf" }));

    const response = await app.request(API.accounts.files.upload, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(response.status).toBe(202);
    const body = await readApiJson<JobCreatedResponse>(response);
    expect(body.data.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    const job = await waitForJobInServices(services, "uploaduser", body.data.jobId, {
      wantStatus: "completed",
    });
    expect(job.status).toBe("completed");
  });
});
