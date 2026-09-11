import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginViaApp } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";
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
  cancelled_ids: string[];
};

type JobCreatedResponse = {
  id: string;
};

const UNKNOWN_JOB_ID = "00000000-0000-4000-8000-000000000099";

describe("jobs routes", () => {
  test("GET /api/v1/jobs returns empty list initially", async () => {
    const services = await createAuthTestServices("jobuser1", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "jobuser1", "password123");

    const response = await app.request(API.jobs.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<JobListResponse>(response);
    expect(body.data.total).toBe(0);
  });

  test("POST /api/v1/jobs/cancel returns 404 when id does not exist", async () => {
    const services = await createAuthTestServices("jobcancel404", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "jobcancel404", "password123");

    const response = await app.request(`${API.jobs.cancel}?id=${UNKNOWN_JOB_ID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(404);
  });

  test("POST /api/v1/jobs/cancel returns empty list when no active jobs exist", async () => {
    const services = await createAuthTestServices("jobcancelall", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "jobcancelall", "password123");

    const response = await app.request(API.jobs.cancel, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<JobsCancelResponse>(response);
    expect(body.data.cancelled_ids).toEqual([]);
  });

  test("POST /api/v1/accounts/statements/sync rejects without sources", async () => {
    const services = await createAuthTestServices("jobrunuser1", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "jobrunuser1", "password123");

    const response = await app.request(API.accounts.statements.sync, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test("POST /api/v1/accounts/statements/sync enqueues job that fails when profile is missing", async () => {
    const services = await createAuthTestServices("jobrunuser2", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "jobrunuser2", "password123");

    const sourcesResponse = await app.request(API.sources, {
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
        account_type: "credit_card",
        opening_date: "2020-01-15",
        account_number: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });
    expect(createResponse.status).toBe(201);

    const response = await app.request(API.accounts.statements.sync, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: {} }),
    });

    expect(response.status).toBe(202);
    const body = await readApiJson<JobCreatedResponse>(response);
    const job = await waitForJobInServices(services, "jobrunuser2", body.data.id, {
      wantStatus: "failed",
    });
    expect(job.status).toBe("failed");
    expect(job.error).toContain("profile directory not found");
  });

  test("GET /api/v1/jobs returns 401 without auth", async () => {
    const services = await createAuthTestServices("jobuser2", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.jobs.list);
    expect(response.status).toBe(401);
  });
});
