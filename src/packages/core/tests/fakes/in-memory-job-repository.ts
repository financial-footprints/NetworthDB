import type { JobStage } from "@core/domains/jobs/constants";
import { isActiveJobStatus } from "@core/domains/jobs/constants";
import type { JobScope } from "@core/domains/jobs/embedded/scope";
import { Job } from "@core/domains/jobs/entities/job";
import type {
  JobFilters,
  JobRepository,
  JobSortColumn,
} from "@core/domains/jobs/repositories/job-repository";
import type { Pagination, Sort } from "@core/shared/query";

export class InMemoryJobRepository implements JobRepository {
  private readonly byId = new Map<string, Job>();

  async create(job: Job): Promise<Job> {
    this.byId.set(job.id, job);
    return job;
  }

  async findById(userId: string, id: string): Promise<Job | null> {
    const rows = await this.findByFilters({ id, userId });
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: JobFilters,
    sort?: Sort<JobSortColumn>,
    pagination?: Pagination
  ): Promise<Job[]> {
    let rows = [...this.byId.values()].filter((job) => this.matchesFilters(job, filters));

    if (sort) {
      rows.sort((a, b) => {
        const left = a.createdAt.getTime();
        const right = b.createdAt.getTime();
        return sort.direction === "desc" ? right - left : left - right;
      });
    }

    if (pagination) {
      rows = rows.slice(pagination.offset, pagination.offset + pagination.limit);
    }

    return rows;
  }

  async save(job: Job): Promise<Job | null> {
    const existing = this.byId.get(job.id);

    if (job.status === "running") {
      if (existing?.status !== "queued") {
        return existing ?? null;
      }

      this.byId.set(job.id, job);
      return job;
    }

    if (!isActiveJobStatus(job.status)) {
      if (!existing || !isActiveJobStatus(existing.status)) {
        return existing ?? null;
      }

      this.byId.set(job.id, job);
      return job;
    }

    throw new Error("database.jobs.save.invalid.status");
  }

  async aggregate(filters: JobFilters): Promise<number> {
    return [...this.byId.values()].filter((job) => this.matchesFilters(job, filters)).length;
  }

  async delete(filters: JobFilters): Promise<void> {
    if (!filters.id || !filters.userId) {
      throw new Error("database.jobs.delete.invalid.missing-filters");
    }

    const job = this.byId.get(filters.id);
    if (job && job.userId === filters.userId) {
      this.byId.delete(filters.id);
    }
  }

  async findConflict(userId: string, stage: JobStage, scope: JobScope): Promise<Job | null> {
    const key = scope.toCanonicalJson();
    for (const job of this.byId.values()) {
      if (
        job.userId === userId &&
        job.stage === stage &&
        job.scope.toCanonicalJson() === key &&
        isActiveJobStatus(job.status)
      ) {
        return job;
      }
    }

    return null;
  }

  async recover(error: string): Promise<number> {
    let count = 0;
    for (const job of this.byId.values()) {
      if (isActiveJobStatus(job.status)) {
        const saved = await this.save(job.fail(error));
        if (saved) {
          count += 1;
        }
      }
    }

    return count;
  }

  async clean(date: Date): Promise<number> {
    let count = 0;
    for (const [id, job] of this.byId.entries()) {
      if (job.logs && job.completedAt && job.completedAt.getTime() < date.getTime()) {
        this.byId.set(
          id,
          new Job(
            job.id,
            job.userId,
            job.stage,
            job.status,
            job.scope,
            job.createdAt,
            job.completedAt,
            job.output,
            job.error,
            null
          )
        );
        count += 1;
      }
    }

    return count;
  }

  private matchesFilters(job: Job, filters: JobFilters): boolean {
    if (filters.id !== undefined && job.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && job.userId !== filters.userId) {
      return false;
    }
    if (filters.stage !== undefined && job.stage !== filters.stage) {
      return false;
    }
    if (filters.status !== undefined && job.status !== filters.status) {
      return false;
    }
    if (filters.statuses !== undefined && !filters.statuses.includes(job.status)) {
      return false;
    }
    if (filters.active === true && !isActiveJobStatus(job.status)) {
      return false;
    }
    if (filters.scopeKey !== undefined && job.scope.toCanonicalJson() !== filters.scopeKey) {
      return false;
    }

    return true;
  }
}
