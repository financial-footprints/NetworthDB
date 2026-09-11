import { cryptography } from "@database/encryption";
import { applyPagination, applySort } from "@database/repositories/helpers";
import { jobs } from "@database/schema/jobs";
import type { DbClient } from "@database/types";
import {
  ACTIVE_JOB_STATUSES,
  EMPTY_JOB_OUTPUT,
  Job,
  type JobFilters,
  type JobLogs,
  type JobOutput,
  type JobRepository,
  JobScope,
  type JobSortColumn,
  type JobStage,
  type Pagination,
  type Sort,
} from "@ndb/core";
import { and, count, eq, inArray, isNotNull, lt, type SQL } from "drizzle-orm";

async function fromRow(db: DbClient, row: typeof jobs.$inferSelect): Promise<Job> {
  const output = row.output
    ? (JSON.parse(
        (await cryptography.decrypt(db, row.userId, row.output)).toString("utf8")
      ) as JobOutput)
    : EMPTY_JOB_OUTPUT;
  const error = row.error
    ? (await cryptography.decrypt(db, row.userId, row.error)).toString("utf8")
    : null;
  const logs = row.logs
    ? ((await cryptography.decrypt(db, row.userId, row.logs)).toString("utf8") as JobLogs)
    : null;

  return new Job(
    row.id,
    row.userId,
    row.stage,
    row.status,
    JobScope.toScope(row.jobScope),
    row.createdAt,
    row.completedAt,
    output,
    error,
    logs
  );
}

async function toRow(db: DbClient, job: Job) {
  return {
    id: job.id,
    userId: job.userId,
    stage: job.stage,
    status: job.status,
    jobScopeKey: job.scope.toCanonicalJson(),
    jobScope: job.scope.toJson(),
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    output: await cryptography.encrypt(
      db,
      job.userId,
      Buffer.from(JSON.stringify(job.output), "utf8")
    ),
    error: job.error
      ? await cryptography.encrypt(db, job.userId, Buffer.from(job.error, "utf8"))
      : null,
    logs: job.logs
      ? await cryptography.encrypt(db, job.userId, Buffer.from(job.logs, "utf8"))
      : null,
  };
}

export class DrizzleJobRepository implements JobRepository {
  constructor(private readonly db: DbClient) {}

  async create(job: Job): Promise<Job> {
    const rows = await this.db
      .insert(jobs)
      .values({
        id: job.id,
        userId: job.userId,
        stage: job.stage,
        status: job.status,
        jobScopeKey: job.scope.toCanonicalJson(),
        jobScope: job.scope.toJson(),
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        output: null,
        error: null,
        logs: null,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("database.jobs.create.error.no-row");
    }

    return new Job(
      row.id,
      row.userId,
      row.stage,
      row.status,
      JobScope.toScope(row.jobScope),
      row.createdAt,
      row.completedAt,
      job.output,
      job.error,
      job.logs
    );
  }

  async findConflict(userId: string, stage: JobStage, scope: JobScope): Promise<Job | null> {
    const scopeKey = scope.toCanonicalJson();
    const rows = await this.db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.userId, userId),
          eq(jobs.stage, stage),
          eq(jobs.jobScopeKey, scopeKey),
          inArray(jobs.status, [...ACTIVE_JOB_STATUSES])
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return fromRow(this.db, row);
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
    const where = this._filter(filters);
    const orderBy = applySort<JobSortColumn>({ createdAt: jobs.createdAt }, sort);
    let query = this.db.select().from(jobs).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    const rows = await applyPagination(query, pagination);
    return Promise.all(rows.map((row) => fromRow(this.db, row)));
  }

  async aggregate(filters: JobFilters): Promise<number> {
    const where = this._filter(filters);
    const rows = await this.db.select({ value: count() }).from(jobs).where(where);
    return Number(rows[0]?.value ?? 0);
  }

  async save(job: Job): Promise<Job | null> {
    if (job.status === "running") {
      const updated = await this.db
        .update(jobs)
        .set({ status: "running" })
        .where(and(eq(jobs.id, job.id), eq(jobs.status, "queued")))
        .returning();

      const updatedRow = updated[0];
      if (!updatedRow) {
        const rows = await this.findByFilters({ id: job.id });
        return rows[0] ?? null;
      }

      return fromRow(this.db, updatedRow);
    }

    if (job.status !== "queued") {
      const rowData = await toRow(this.db, job);
      const updated = await this.db
        .update(jobs)
        .set({
          status: rowData.status,
          completedAt: rowData.completedAt,
          output: rowData.output,
          error: rowData.error,
          logs: rowData.logs,
        })
        .where(and(eq(jobs.id, job.id), inArray(jobs.status, [...ACTIVE_JOB_STATUSES])))
        .returning();

      const updatedRow = updated[0];
      if (!updatedRow) {
        const rows = await this.findByFilters({ id: job.id });
        return rows[0] ?? null;
      }

      return fromRow(this.db, updatedRow);
    }

    throw new Error("database.jobs.save.invalid.status");
  }

  async clean(date: Date): Promise<number> {
    const updated = await this.db
      .update(jobs)
      .set({ logs: null })
      .where(and(isNotNull(jobs.logs), lt(jobs.completedAt, date)))
      .returning({ id: jobs.id });

    return updated.length;
  }

  async recover(error: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(inArray(jobs.status, [...ACTIVE_JOB_STATUSES]));

    let count = 0;
    for (const row of rows) {
      const job = await fromRow(this.db, row);
      const saved = await this.save(job.fail(error));
      if (saved) {
        count += 1;
      }
    }

    return count;
  }

  async delete(filters: JobFilters): Promise<void> {
    const where = this._filter(filters);
    if (!filters.id || !filters.userId) {
      throw new Error("database.jobs.delete.invalid.missing-filters");
    }

    if (where) {
      await this.db.delete(jobs).where(where);
    }
  }

  private _filter(filters: JobFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(jobs.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(jobs.userId, filters.userId));
    }
    if (filters.stage !== undefined) {
      conditions.push(eq(jobs.stage, filters.stage));
    }
    if (filters.status !== undefined) {
      conditions.push(eq(jobs.status, filters.status));
    }
    if (filters.statuses !== undefined && filters.statuses.length > 0) {
      conditions.push(inArray(jobs.status, filters.statuses));
    }
    if (filters.active === true) {
      conditions.push(inArray(jobs.status, [...ACTIVE_JOB_STATUSES]));
    }
    if (filters.scopeKey !== undefined) {
      conditions.push(eq(jobs.jobScopeKey, filters.scopeKey));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
