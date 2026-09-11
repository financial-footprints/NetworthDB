import type { JobStage, JobStatus } from "@core/domains/jobs/constants";
import { EMPTY_JOB_OUTPUT, type JobLogs, type JobOutput } from "@core/domains/jobs/embedded/output";
import type { JobScope } from "@core/domains/jobs/embedded/scope";

export class Job {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly stage: JobStage,
    public readonly status: JobStatus,
    public readonly scope: JobScope,
    public readonly createdAt: Date,
    public readonly completedAt: Date | null,
    public readonly output: JobOutput,
    public readonly error: string | null,
    public readonly logs: JobLogs | null = null
  ) {}

  static create(props: {
    id?: string;
    userId: string;
    stage: JobStage;
    scope: JobScope;
    createdAt?: Date;
  }): Job {
    const now = props.createdAt ?? new Date();
    return new Job(
      props.id ?? crypto.randomUUID(),
      props.userId,
      props.stage,
      "queued",
      props.scope,
      now,
      null,
      EMPTY_JOB_OUTPUT,
      null,
      null
    );
  }

  isActive(): boolean {
    return this.status === "queued" || this.status === "running";
  }

  markRunning(): Job | null {
    if (this.status !== "queued") {
      return null;
    }

    return this.withStatus("running");
  }

  complete(output?: JobOutput, logs?: JobLogs | null): Job {
    return new Job(
      this.id,
      this.userId,
      this.stage,
      "completed",
      this.scope,
      this.createdAt,
      new Date(),
      output ?? EMPTY_JOB_OUTPUT,
      this.error,
      logs ?? this.logs
    );
  }

  fail(error: string, output?: JobOutput, logs?: JobLogs | null): Job {
    return new Job(
      this.id,
      this.userId,
      this.stage,
      "failed",
      this.scope,
      this.createdAt,
      new Date(),
      output ?? this.output,
      error,
      logs ?? this.logs
    );
  }

  cancel(output?: JobOutput, logs?: JobLogs | null): Job {
    return new Job(
      this.id,
      this.userId,
      this.stage,
      "cancelled",
      this.scope,
      this.createdAt,
      new Date(),
      output ?? this.output,
      this.error,
      logs ?? this.logs
    );
  }

  private withStatus(status: JobStatus): Job {
    return new Job(
      this.id,
      this.userId,
      this.stage,
      status,
      this.scope,
      this.createdAt,
      this.completedAt,
      this.output,
      this.error,
      this.logs
    );
  }
}
