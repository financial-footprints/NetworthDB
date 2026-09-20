import { Account, PipelineRun, type Source } from "@ndb/core";

export type PipelineSnapshot = {
  kind: "sync" | "upload" | "delete";
  jobId: string;
  userId: string;
  account: {
    id: string;
    userId: string;
    accountType: string;
    bank: string;
    variant: string | null;
    label: string;
    openingDate: string;
    closingDate: string | null;
    accountNumber: string;
    passwords: string[];
    mail: Account["mail"];
    statement: Account["statement"];
    createdAt: string;
    updatedAt: string;
  };
  sources: Source[];
  financialYear: string | null;
  dataKey: Buffer | null;
  trace: boolean;
  upload?: {
    format: string;
    statementDate: string | null;
  };
};

function snapshotAccount(account: Account): PipelineSnapshot["account"] {
  return {
    id: account.id,
    userId: account.userId,
    accountType: account.accountType,
    bank: account.bank,
    variant: account.variant,
    label: account.label,
    openingDate: account.openingDate,
    closingDate: account.closingDate,
    accountNumber: account.accountNumber,
    passwords: [...account.passwords],
    mail: account.mail
      ? {
          subjects: [...account.mail.subjects],
          bodyContains: [...account.mail.bodyContains],
          fromAddresses: [...account.mail.fromAddresses],
        }
      : null,
    statement: account.statement
      ? {
          textContains: [...account.statement.textContains],
          textNotContains: [...account.statement.textNotContains],
        }
      : null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function restoreAccount(snapshot: PipelineSnapshot["account"]): Account {
  return new Account(
    snapshot.id,
    snapshot.userId,
    snapshot.accountType as Account["accountType"],
    snapshot.bank,
    snapshot.variant,
    snapshot.label,
    snapshot.openingDate,
    snapshot.closingDate,
    snapshot.accountNumber,
    [...snapshot.passwords],
    snapshot.mail,
    snapshot.statement,
    snapshot.createdAt,
    snapshot.updatedAt
  );
}

export function serializePipelineRun(pipeline: PipelineRun): PipelineSnapshot {
  const snapshot: PipelineSnapshot = {
    kind: pipeline.kind,
    jobId: pipeline.jobId,
    userId: pipeline.userId,
    account: snapshotAccount(pipeline.account),
    sources: structuredClone(pipeline.sources),
    financialYear: pipeline.financialYear,
    dataKey: pipeline.dataKey,
    trace: pipeline.trace,
  };
  if (pipeline.kind === "upload" && pipeline.upload) {
    snapshot.upload = { ...pipeline.upload };
  }
  return snapshot;
}

export function deserializePipelineRun(snapshot: PipelineSnapshot): PipelineRun {
  const account = restoreAccount(snapshot.account);
  if (snapshot.kind === "sync") {
    return PipelineRun.createSync({
      jobId: snapshot.jobId,
      userId: snapshot.userId,
      account,
      sources: snapshot.sources,
      financialYear: snapshot.financialYear,
      dataKey: snapshot.dataKey,
      trace: snapshot.trace,
    });
  }
  if (snapshot.kind === "upload") {
    return PipelineRun.createUpload({
      jobId: snapshot.jobId,
      userId: snapshot.userId,
      account,
      format: snapshot.upload?.format ?? "pdf",
      statementDate: snapshot.upload?.statementDate ?? null,
      dataKey: snapshot.dataKey,
      trace: snapshot.trace,
    });
  }
  return PipelineRun.createDelete({
    jobId: snapshot.jobId,
    userId: snapshot.userId,
    account,
    dataKey: snapshot.dataKey,
    trace: snapshot.trace,
  });
}
