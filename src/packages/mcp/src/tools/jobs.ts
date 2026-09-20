import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod } from "@mcp/tools/helpers";
import { emptyArgsSchema } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { isActiveJobStatus } from "@ndb/core";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const JOB_TOOL_NAMES = ["jobs_list", "jobs_get", "jobs_cancel", "jobs_wait"] as const;

const DEFAULT_POLL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const jobsIdSchema = z.object({
  id: z.string().uuid(),
});

const jobsCancelSchema = z.object({
  id: z.string().uuid().optional(),
});

const jobsWaitSchema = z.object({
  id: z.string().uuid(),
  timeout_ms: z.number().int().positive().optional(),
});

type JobRecord = {
  status: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.jobs.missing-catalog.${name}`);
  }
  return entry;
}

export function createJobTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("jobs_list"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return session.getJson(API.jobs.list);
      },
    }),
    bindMethod({
      catalog: catalogEntry("jobs_get"),
      schema: jobsIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.getJson(apiPath(API.jobs.get, { jobId: input.id }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("jobs_cancel"),
      schema: jobsCancelSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(API.jobs.cancel, {
          jobId: input.id,
        });
        return session.requestJson("POST", path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("jobs_wait"),
      schema: jobsWaitSchema,
      invoke: async (input) => {
        requireSession(session);
        const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
        const deadline = Date.now() + timeoutMs;
        const path = apiPath(API.jobs.get, { jobId: input.id });

        while (Date.now() < deadline) {
          const job = await session.getJson<JobRecord>(path);
          if (!isActiveJobStatus(job.status)) {
            return job;
          }
          await sleep(DEFAULT_POLL_MS);
        }

        throw new Error("mcp.jobs.wait.timeout");
      },
    }),
  ];
}
