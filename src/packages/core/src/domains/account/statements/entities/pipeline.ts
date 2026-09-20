import type { Account } from "@core/domains/account/entities/account";
import type { Source } from "@core/domains/sources/entities/sources";

export type PipelineKind = "sync" | "upload" | "delete";

type PipelineBase = {
  jobId: string;
  userId: string;
  account: Account;
  sources: Source[];
  financialYear: string | null;
  dataKey: Buffer | null;
  trace: boolean;
};

type PipelineUpload = PipelineBase & {
  kind: "upload";
  upload: {
    format: string;
    statementDate: string | null;
  };
};

type PipelineSync = PipelineBase & {
  kind: "sync";
};

type PipelineDelete = PipelineBase & {
  kind: "delete";
};

export type Pipeline = PipelineSync | PipelineUpload | PipelineDelete;

export class PipelineRun {
  readonly kind: PipelineKind;
  readonly jobId: string;
  readonly userId: string;
  readonly account: Account;
  readonly sources: Source[];
  readonly financialYear: string | null;
  readonly dataKey: Buffer | null;
  readonly trace: boolean;
  readonly upload?: {
    format: string;
    statementDate: string | null;
  };

  private constructor(input: Pipeline) {
    this.kind = input.kind;
    this.jobId = input.jobId;
    this.userId = input.userId;
    this.account = input.account;
    this.sources = input.sources;
    this.financialYear = input.financialYear;
    this.dataKey = input.dataKey;
    this.trace = input.trace;
    if (input.kind === "upload") {
      this.upload = input.upload;
    }
  }

  static createSync(input: {
    jobId: string;
    userId: string;
    account: Account;
    sources: Source[];
    financialYear?: string | null;
    dataKey: Buffer | null;
    trace: boolean;
  }): PipelineRun {
    return new PipelineRun({
      kind: "sync",
      jobId: input.jobId,
      userId: input.userId,
      account: input.account,
      sources: input.sources,
      financialYear: input.financialYear ?? null,
      dataKey: input.dataKey,
      trace: input.trace,
    });
  }

  static createUpload(input: {
    jobId: string;
    userId: string;
    account: Account;
    format: string;
    statementDate: string | null;
    dataKey: Buffer | null;
    trace: boolean;
  }): PipelineRun {
    return new PipelineRun({
      kind: "upload",
      jobId: input.jobId,
      userId: input.userId,
      account: input.account,
      sources: [],
      financialYear: null,
      dataKey: input.dataKey,
      trace: input.trace,
      upload: {
        format: input.format,
        statementDate: input.statementDate,
      },
    });
  }

  static createDelete(input: {
    jobId: string;
    userId: string;
    account: Account;
    dataKey: Buffer | null;
    trace: boolean;
  }): PipelineRun {
    return new PipelineRun({
      kind: "delete",
      jobId: input.jobId,
      userId: input.userId,
      account: input.account,
      sources: [],
      financialYear: null,
      dataKey: input.dataKey,
      trace: input.trace,
    });
  }
}
