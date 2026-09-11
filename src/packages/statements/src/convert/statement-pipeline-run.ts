import type { PipelineContext } from "@ndb/core";
import type { StatementsRun as NativeStatementsRun } from "../../native.d.ts";
import { account } from "./account.ts";
import { source } from "./source.ts";

export const statementPipelineRun = {
  fromDomain: (context: PipelineContext): NativeStatementsRun => ({
    userId: context.userId,
    scope: {
      accountId: context.scope.accountId,
      financialYear: context.scope.financialYear,
    },
    accounts: context.accounts.map(account.fromDomain),
    sources: context.sources.map(source.fromDomain),
  }),
};
