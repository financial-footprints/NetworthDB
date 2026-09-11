import type { Account } from "@core/domains/account/entities/account";
import type { JobScope } from "@core/domains/jobs/embedded/scope";
import type { Source } from "@core/domains/sources/entities/sources";
import type { StatementEngine } from "@core/ports/statement-engine";

export type StatementsRuntime = {
  engine: StatementEngine;
  pipelineTrace: boolean;
};

export type PipelineContext = {
  userId: string;
  scope: {
    accountId: string | null;
    financialYear: string | null;
  };
  accounts: Account[];
  sources: Source[];
};

export function createPipelineContext(input: {
  userId: string;
  jobScope: JobScope;
  accounts: Account[];
  sources: Source[];
}): PipelineContext {
  return {
    userId: input.userId,
    scope: {
      accountId: input.jobScope.accountId,
      financialYear: input.jobScope.financialYear,
    },
    accounts: input.accounts,
    sources: input.sources,
  };
}
