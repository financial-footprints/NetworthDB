import { AccountService, JobRunnerService, JobService, SourcesService } from "@ndb/core";
import { createInMemoryStatementEngine } from "@tests/api/fakes/in-memory-statement-engine";
import { InMemoryAccountRepository } from "@tests/core/fakes/in-memory-account-repository";
import { InMemoryJobRepository } from "@tests/core/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@tests/core/fakes/in-memory-sources-repository";
import { nullUserDataKeyLoader } from "@tests/core/fakes/null-user-data-key-loader";

export function createStatementsTestServices(accountRepository = new InMemoryAccountRepository()) {
  const statements = {
    engine: createInMemoryStatementEngine(),
    pipelineTrace: false,
  };
  const jobRepository = new InMemoryJobRepository();
  const jobRunner = new JobRunnerService(jobRepository, 2);
  const sourcesRepository = new InMemorySourcesRepository();
  const sources = new SourcesService(sourcesRepository);
  const job = new JobService(jobRepository, jobRunner);
  const account = new AccountService(
    accountRepository,
    sources,
    jobRunner,
    nullUserDataKeyLoader,
    statements
  );

  return {
    account,
    sources,
    sourcesRepository,
    job,
    jobRunner,
    accountRepository,
  };
}
