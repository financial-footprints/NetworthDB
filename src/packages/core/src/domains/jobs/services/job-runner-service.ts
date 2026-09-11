import type { JobStage } from "@core/domains/jobs/constants";
import {
  EMPTY_JOB_OUTPUT,
  JobExecutionError,
  type JobLogs,
  type JobOutput,
} from "@core/domains/jobs/embedded/output";
import type { JobScope } from "@core/domains/jobs/embedded/scope";
import { Job } from "@core/domains/jobs/entities/job";
import type { JobRepository } from "@core/domains/jobs/repositories/job-repository";
import { ConflictError } from "@core/shared/errors/domain-error";

const DAY_MS = 24 * 60 * 60 * 1000;

export type JobFnResult = {
  output?: JobOutput;
  logs?: JobLogs;
};

export type JobFn = (jobId: string, shouldCancel: () => boolean) => Promise<JobFnResult>;

export class JobRunnerService {
  private readonly cancelFlags = new Map<string, { cancelled: boolean }>();
  private readonly cancelListeners: Array<(jobId: string) => void> = [];
  private activeWorkers = 0;
  private readonly queue: Array<() => void> = [];
  private shuttingDown = false;

  constructor(
    private readonly jobs: JobRepository,
    private readonly maxWorkers: number
  ) {}

  async submit(userId: string, stage: JobStage, scope: JobScope, fn: JobFn): Promise<Job> {
    if (this.shuttingDown) {
      throw new ConflictError("core.jobs.create.conflict.shutting-down");
    }

    const conflict = await this.jobs.findConflict(userId, stage, scope);
    if (conflict) {
      throw new ConflictError("core.jobs.create.conflict.active-job", {
        id: conflict.id,
        status: conflict.status,
      });
    }

    const job = await this.jobs.create(
      Job.create({
        userId,
        stage,
        scope,
      })
    );
    this.cancelFlags.set(job.id, { cancelled: false });

    this.enqueue(() => {
      void this.runJob(job, fn);
    });

    return job;
  }

  async requestCancel(userId: string, jobId: string): Promise<Job | null> {
    const job = await this.jobs.findById(userId, jobId);
    if (!job) {
      return null;
    }

    const flag = this.cancelFlags.get(jobId);
    if (flag) {
      flag.cancelled = true;
      for (const listener of this.cancelListeners) {
        listener(jobId);
      }
    }

    if (job.isActive()) {
      const updated = await this.jobs.save(job.cancel());
      return updated ?? job;
    }

    return job;
  }

  async requestCancelAll(userId: string): Promise<string[]> {
    const active = await this.jobs.findByFilters({ userId, active: true });
    const cancelledIds: string[] = [];

    for (const job of active) {
      const updated = await this.requestCancel(userId, job.id);
      if (updated?.status === "cancelled") {
        cancelledIds.push(updated.id);
      }
    }

    return cancelledIds;
  }

  async recoverJobs(error = "server restarted"): Promise<number> {
    return this.jobs.recover(error);
  }

  async purgeExpiredLogs(retentionDays = 14): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
    return this.jobs.clean(cutoff);
  }

  onCancel(listener: (jobId: string) => void): void {
    this.cancelListeners.push(listener);
  }

  shutdown(): void {
    this.shuttingDown = true;
    for (const flag of this.cancelFlags.values()) {
      flag.cancelled = true;
    }
  }

  private enqueue(task: () => void): void {
    if (this.activeWorkers < this.maxWorkers) {
      this.activeWorkers += 1;
      task();
      return;
    }

    this.queue.push(task);
  }

  private releaseWorker(): void {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }

    this.activeWorkers -= 1;
  }

  private async runJob(job: Job, fn: JobFn): Promise<void> {
    const shouldCancel = () => this.cancelFlags.get(job.id)?.cancelled === true;
    let current = job;
    let lastOutput = EMPTY_JOB_OUTPUT;
    let lastLogs: JobLogs | undefined;

    try {
      const started = await this.tryStartJob(current, shouldCancel);
      if (!started) {
        return;
      }
      current = started;

      const result = await fn(current.id, shouldCancel);
      lastOutput = result?.output ?? EMPTY_JOB_OUTPUT;
      lastLogs = result?.logs;

      await this.finishJob(current, shouldCancel, lastOutput, lastLogs);
    } catch (error) {
      await this.failJob(current, error, lastOutput, lastLogs);
    } finally {
      this.cancelFlags.delete(job.id);
      this.releaseWorker();
    }
  }

  private async tryStartJob(job: Job, shouldCancel: () => boolean): Promise<Job | null> {
    if (shouldCancel()) {
      await this.jobs.save(job.cancel());
      return null;
    }

    const running = job.markRunning();
    if (!running) {
      await this.jobs.save(job.cancel());
      return null;
    }

    const started = await this.jobs.save(running);
    if (!started || shouldCancel()) {
      await this.jobs.save((started ?? job).cancel());
      return null;
    }

    return started;
  }

  private async finishJob(
    current: Job,
    shouldCancel: () => boolean,
    output: JobOutput,
    logs?: JobLogs
  ): Promise<void> {
    if (shouldCancel()) {
      await this.jobs.save(current.cancel(output, logs));
      return;
    }

    await this.jobs.save(current.complete(output, logs));
  }

  private async failJob(
    current: Job,
    error: unknown,
    lastOutput: JobOutput,
    lastLogs?: JobLogs
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const output = error instanceof JobExecutionError ? (error.output ?? lastOutput) : lastOutput;
    const logs = error instanceof JobExecutionError ? (error.logs ?? lastLogs) : lastLogs;
    await this.jobs.save(current.fail(message, output, logs));
  }
}
