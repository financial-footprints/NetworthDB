import type { JobApi as PlatformJobApi } from "@ndb/platform";
import type { ListData } from "@web/utils/api/types";

export type JobApi = PlatformJobApi;

export type JobStatus = JobApi["status"];

export type JobListData = ListData<JobApi>;

export type JobCreatedResponse = {
  jobId: string;
};
