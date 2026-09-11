import { API } from "@ndb/platform";
import { get, post } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/endpoints/auth";
import type { JobListResponse, JobResponse } from "@web/utils/api/endpoints/jobs/types";
import { createVersionedResource } from "@web/utils/api/helpers";
import { apiPath } from "@web/utils/api/path";

const detailsCache = new Map<string, Promise<JobResponse>>();

type JobsCancelAllResponse = {
  cancelled_ids: string[];
};

export function loadJobs(): Promise<JobListResponse> {
  return withSessionToken((sessionToken) =>
    get<JobListResponse>(API.jobs.list, { sessionToken: sessionToken }).then(
      (response) => response.data
    )
  );
}

export function loadJob(jobId: string): Promise<JobResponse> {
  return withSessionToken((sessionToken) =>
    get<JobResponse>(apiPath(API.jobs.details, { id: jobId }), {
      sessionToken: sessionToken,
    }).then((response) => response.data)
  );
}

const jobsList = createVersionedResource(loadJobs);

export function readJob(jobId: string): Promise<JobResponse> {
  let promise = detailsCache.get(jobId);
  if (!promise) {
    promise = loadJob(jobId);
    detailsCache.set(jobId, promise);
  }
  return promise;
}

export function cacheJobs(data: JobListResponse): void {
  jobsList.setCache(data);
}

export function cacheJob(job: JobResponse): void {
  detailsCache.set(job.id, Promise.resolve(job));
}

export function invalidateJobs(): void {
  jobsList.invalidate();
}

export function invalidateJob(jobId: string): void {
  detailsCache.delete(jobId);
}

export function useJobs(): JobListResponse {
  return jobsList.useResource();
}

export async function cancelJob(jobId: string): Promise<JobResponse> {
  invalidateJob(jobId);
  jobsList.invalidate();
  await withSessionToken((sessionToken) =>
    post<JobsCancelAllResponse>(API.jobs.cancel, undefined, {
      sessionToken: sessionToken,
      params: { id: jobId },
    })
  );
  return readJob(jobId);
}

export function cancelAllJobs(): Promise<JobsCancelAllResponse> {
  jobsList.invalidate();
  detailsCache.clear();
  return withSessionToken((sessionToken) =>
    post<JobsCancelAllResponse>(API.jobs.cancel, undefined, {
      sessionToken: sessionToken,
    }).then((response) => response.data)
  );
}

export function isActiveJob(job: JobResponse): boolean {
  return job.status === "queued" || job.status === "running";
}
