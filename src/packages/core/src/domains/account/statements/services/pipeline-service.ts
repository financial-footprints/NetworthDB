import { isSystemAccountType, supportsStatements } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { executeStatementJob } from "@core/domains/account/statements/embedded/statement-job";
import type { StatementsServices } from "@core/domains/account/statements/embedded/statements-services";
import { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import type { LedgerIngestService } from "@core/domains/account/transactions/services/ledger-ingest-service";
import { assertAal2 } from "@core/domains/auth/helpers";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import type { SourcesService } from "@core/domains/sources/services/sources-service";
import type { User } from "@core/domains/user/entities/user/index";
import type { UserDataKeyLoader } from "@core/ports/encryption";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";

export type StatementSyncInput = {
  accountId: string;
  financialYear?: string | null;
};

export type StatementSyncResult = {
  jobId: string;
};

function rejectSystem(account: Account): void {
  if (isSystemAccountType(account.accountType)) {
    throw new ValidationError("This operation is not allowed on system accounts.");
  }
}

function rejectNonStatement(account: Account): void {
  rejectSystem(account);
  if (!supportsStatements(account.accountType)) {
    throw new ValidationError("Statements are not supported for this account type.");
  }
}

export class PipelineService {
  private ledgerIngest: LedgerIngestService | null = null;

  constructor(
    private readonly accounts: AccountRepository,
    private readonly sources: SourcesService,
    private readonly runner: JobRunnerService,
    private readonly keys: UserDataKeyLoader,
    private readonly statements: StatementsServices
  ) {}

  attachLedgerIngest(ingest: LedgerIngestService): void {
    this.ledgerIngest = ingest;
  }

  async sync(user: User, authAcr: string, input: StatementSyncInput): Promise<StatementSyncResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    if (!input.accountId?.trim()) {
      throw new ValidationError("Account id is required.");
    }

    const account = await this.getAccount(user.id, input.accountId);
    rejectNonStatement(account);

    const configuredSources = await this.sources.requireSources(user, authAcr);
    const scope = JobScope.create({
      accountId: input.accountId,
      financialYear: input.financialYear,
    });

    const job = await this.runner.submit(
      user.id,
      "sync",
      scope,
      async (jobId, shouldCancel, appendLog) => {
        const dataKey = await this.keys.ensure(user.id);
        const pipeline = PipelineRun.createSync({
          jobId,
          userId: user.id,
          account,
          sources: configuredSources.sources,
          financialYear: scope.financialYear,
          dataKey,
          trace: this.statements.trace,
        });

        const result = await executeStatementJob(
          pipeline,
          shouldCancel,
          appendLog,
          (cancel, onLogLine) =>
            this.statements.engine.processPipeline(pipeline, cancel, onLogLine),
          "statements.pipeline.process.failed"
        );

        if (this.ledgerIngest) {
          await this.ledgerIngest.ingestUnsyncedForAccount(user.id, account, shouldCancel);
        }

        return result;
      }
    );

    return { jobId: job.id };
  }

  private async getAccount(userId: string, accountId: string) {
    const account = await this.accounts.findById(userId, accountId);
    if (!account) {
      throw new EntityNotFoundError("Account", accountId);
    }

    return account;
  }
}
