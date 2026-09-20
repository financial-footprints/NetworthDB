import { API, apiPath, jobListSchema, jobSchema, jobsCancelSchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { createVersionedResource } from "@web/utils/api/helpers";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type { JobApi, JobListData } from "@web/utils/api/routes/jobs/types";

const detailsCache = new Map<string, Promise<JobApi>>();

export function fetchJobs(): Promise<JobListData> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.jobs.list, { sessionToken, schema: jobListSchema })
  );
}

export function fetchJob(jobId: string): Promise<JobApi> {
  return withSessionToken(async (sessionToken) => {
    const response = await apiRequest(apiPath(API.jobs.get, { jobId }), {
      sessionToken,
      schema: jobSchema,
    });
    return response.data;
  });
}

const jobsList = createVersionedResource(fetchJobs);

export function readJob(jobId: string): Promise<JobApi> {
  let promise = detailsCache.get(jobId);
  if (!promise) {
    promise = fetchJob(jobId);
    detailsCache.set(jobId, promise);
  }
  return promise;
}

export function cacheJobs(data: JobListData): void {
  jobsList.setCache(data);
}

export function cacheJob(job: JobApi): void {
  detailsCache.set(job.id, Promise.resolve(job));
}

export function invalidateJobs(): void {
  jobsList.invalidate();
}

export function invalidateJob(jobId: string): void {
  detailsCache.delete(jobId);
}

export function useJobs(): JobListData {
  return jobsList.useResource();
}

export async function cancelJob(jobId: string): Promise<JobApi> {
  invalidateJob(jobId);
  jobsList.invalidate();
  await withSessionToken((sessionToken) =>
    apiRequest(API.jobs.cancel, {
      method: "POST",
      sessionToken,
      params: { jobId },
      schema: jobsCancelSchema,
    })
  );
  return readJob(jobId);
}

export async function cancelAllJobs(): Promise<{ cancelledIds: string[] }> {
  jobsList.invalidate();
  detailsCache.clear();
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.jobs.cancel, { method: "POST", sessionToken, schema: jobsCancelSchema })
  );
  return response.data;
}

export function isActiveJob(job: JobApi): boolean {
  return job.status === "queued" || job.status === "running";
}
