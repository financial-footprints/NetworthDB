import { assertAal2 } from "@core/domains/auth/helpers";
import type { Job } from "@core/domains/jobs/entities/job";
import type { JobRepository } from "@core/domains/jobs/repositories/job-repository";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import type { User } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError } from "@core/shared/errors/domain-error";

export type JobListResult = {
  items: Job[];
  total: number;
};

export type JobsCancelResult = {
  cancelledIds: string[];
};

export class JobService {
  constructor(
    private readonly jobs: JobRepository,
    private readonly runner: JobRunnerService
  ) {}

  async list(user: User, authAcr: string): Promise<JobListResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    const items = await this.jobs.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "desc" },
      { limit: 50, offset: 0 }
    );
    return {
      items,
      total: items.length,
    };
  }

  async get(user: User, authAcr: string, jobId: string): Promise<Job> {
    assertAal2(user.multifactorEnabled, authAcr);
    const job = await this.jobs.findById(user.id, jobId);
    if (!job) {
      throw new EntityNotFoundError("core.jobs.find.not-found", {
        entityName: "Job",
        id: jobId,
      });
    }

    return job;
  }

  async cancel(user: User, authAcr: string, jobId?: string): Promise<JobsCancelResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    if (jobId !== undefined) {
      const existing = await this.jobs.findById(user.id, jobId);
      if (!existing) {
        throw new EntityNotFoundError("core.jobs.find.not-found", {
          entityName: "Job",
          id: jobId,
        });
      }

      const job = await this.runner.requestCancel(user.id, jobId);
      const cancelledIds = job?.status === "cancelled" ? [job.id] : [];
      return { cancelledIds };
    }

    const cancelledIds = await this.runner.requestCancelAll(user.id);
    return { cancelledIds };
  }
}
