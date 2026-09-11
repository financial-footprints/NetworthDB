import type { Account } from "@core/domains/account/entities/account";
import {
  createPipelineContext,
  type StatementsRuntime,
} from "@core/domains/account/modules/statements/embedded/pipeline-context";
import { executeStatementJob } from "@core/domains/account/modules/statements/embedded/statement-job";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import type { SourcesService } from "@core/domains/sources/services/sources-service";
import type { User } from "@core/domains/user/entities/user/index";
import type { UserDataKeyLoader } from "@core/ports/encryption";
import { EntityNotFoundError } from "@core/shared/errors/domain-error";

export type StatementSyncInput = {
  accountId?: string | null;
  financialYear?: string | null;
};

export type StatementSyncResult = {
  jobId: string;
};

export class PipelineService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sources: SourcesService,
    private readonly runner: JobRunnerService,
    private readonly keys: UserDataKeyLoader,
    private readonly statements: StatementsRuntime
  ) {}

  async sync(
    user: User,
    authAcr: string,
    input: StatementSyncInput = {}
  ): Promise<StatementSyncResult> {
    const configuredSources = await this.sources.requireSources(user, authAcr);
    const scope = JobScope.create({
      accountId: input.accountId,
      financialYear: input.financialYear,
    });

    const accountList = await this.getAccounts(user.id, scope);
    const job = await this.runner.submit(user.id, "sync", scope, async (jobId, shouldCancel) => {
      const dataKey = await this.keys.ensure(user.id);
      const context = createPipelineContext({
        userId: user.id,
        jobScope: scope,
        accounts: accountList,
        sources: configuredSources.sources,
      });

      return executeStatementJob(
        this.statements,
        jobId,
        shouldCancel,
        (options) => this.statements.engine.processPipeline(context, dataKey, options),
        "statements.pipeline.process.failed"
      );
    });

    return { jobId: job.id };
  }

  private async getAccounts(userId: string, scope: JobScope): Promise<Account[]> {
    if (scope.accountId) {
      const account = await this.accounts.findById(userId, scope.accountId);
      if (!account) {
        throw new EntityNotFoundError("core.account.find.not-found", {
          entityName: "Account",
          id: scope.accountId,
        });
      }
      return [account];
    }

    return this.accounts.findByFilters({ userId }, { column: "label", direction: "asc" });
  }
}
