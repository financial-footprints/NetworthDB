import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { waitForJobInServices } from "@tests/api/helpers/wait-for-job";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";

type JobResponse = {
  id: string;
  status: string;
  stage: string;
};

type JobListResponse = {
  items: JobResponse[];
  total: number;
};

type JobsCancelResponse = {
  data: {
    cancelledIds: string[];
  };
};

type JobCreatedResponse = {
  data: {
    jobId: string;
  };
};

const UNKNOWN_JOB_ID = "00000000-0000-4000-8000-000000000099";

describe("jobs routes", () => {
  test("GET /api/v1/jobs returns empty list initially", async () => {
    const { app } = await createTestApp({
      username: "jobuser1",
      password: "password123",
    });
    const token = await loginViaApp(app, "jobuser1", "password123");

    const response = await app.request(API.jobs.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<JobListResponse>(response);
    expect(body.total).toBe(0);
  });

  test("POST /api/v1/jobs/cancel returns 404 when id does not exist", async () => {
    const { app } = await createTestApp({
      username: "jobcancel404",
      password: "password123",
    });
    const token = await loginViaApp(app, "jobcancel404", "password123");

    const response = await app.request(`${API.jobs.cancel}?jobId=${UNKNOWN_JOB_ID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(404);
  });

  test("POST /api/v1/jobs/cancel returns empty list when no active jobs exist", async () => {
    const { app } = await createTestApp({
      username: "jobcancelall",
      password: "password123",
    });
    const token = await loginViaApp(app, "jobcancelall", "password123");

    const response = await app.request(API.jobs.cancel, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<JobsCancelResponse>(response);
    expect(body.data.cancelledIds).toEqual([]);
  });

  test("POST /api/v1/accounts/statements/sync rejects without sources", async () => {
    const { app } = await createTestApp({
      username: "jobrunuser1",
      password: "password123",
    });
    const token = await loginViaApp(app, "jobrunuser1", "password123");

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
    const createBody = await readApiJson<{ data: { id: string } }>(createResponse);

    const response = await app.request(API.accounts.statements.sync, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId: createBody.data.id }),
    });

    expect(response.status).toBe(400);
    const body = await readApiJson<{ error: string }>(response);
    expect(String(body.error)).toContain("At least one source is required.");
  });

  test("POST /api/v1/accounts/statements/sync completes with extract warning when profile is missing", async () => {
    const { app, services } = await createTestApp({
      username: "jobrunuser2",
      password: "password123",
    });
    const token = await loginViaApp(app, "jobrunuser2", "password123");

    const sourcesResponse = await app.request(API.sources.put, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sources: [
          {
            id: "tb-1",
            type: "thunderbird",
            profile: "/home/user/.thunderbird/abc",
          },
        ],
      }),
    });
    expect(sourcesResponse.status).toBe(200);

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

    const createBody = await readApiJson<{ data: { id: string } }>(createResponse);

    const response = await app.request(API.accounts.statements.sync, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId: createBody.data.id }),
    });

    expect(response.status).toBe(202);
    const body = await readApiJson<JobCreatedResponse>(response);
    const job = await waitForJobInServices(services, "jobrunuser2", body.data.jobId, {
      wantStatus: "completed",
    });
    expect(job.status).toBe("completed");
    expect(job.error).toBeNull();
    const extractWarning = job.output.warnings.find((row) => row.kind === "extract.failed");
    expect(extractWarning?.message).toContain("profile directory not found");
  });

  test("GET /api/v1/jobs returns 401 without auth", async () => {
    const { app } = await createTestApp({
      username: "jobuser2",
      password: "password123",
    });

    const response = await app.request(API.jobs.list);
    expect(response.status).toBe(401);
  });
});
