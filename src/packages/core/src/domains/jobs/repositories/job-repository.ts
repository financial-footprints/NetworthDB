import type { JobStage, JobStatus } from "@core/domains/jobs/constants";
import type { JobScope } from "@core/domains/jobs/embedded/scope";
import type { Job } from "@core/domains/jobs/entities/job";
import type { Pagination, Sort } from "@core/shared/query";

export type JobFilters = {
  id?: string;
  userId?: string;
  stage?: JobStage;
  status?: JobStatus;
  statuses?: JobStatus[];
  active?: boolean;
  scopeKey?: string;
};

export type JobSortColumn = "createdAt";

export interface JobRepository {
  create(job: Job): Promise<Job>;
  findConflict(userId: string, stage: JobStage, scope: JobScope): Promise<Job | null>;
  findById(userId: string, id: string): Promise<Job | null>;
  findByFilters(
    filters: JobFilters,
    sort?: Sort<JobSortColumn>,
    pagination?: Pagination
  ): Promise<Job[]>;
  save(job: Job): Promise<Job | null>;
  aggregate(filters: JobFilters): Promise<number>;
  delete(filters: JobFilters): Promise<void>;
  recover(error: string): Promise<number>;
  clean(date: Date): Promise<number>;
}
