import {
  AccountService,
  BackupService,
  CategoryService,
  DashboardService,
  JobRunnerService,
  JobService,
  LedgerIngestService,
  RuleEngineService,
  RuleGroupService,
  RuleService,
  SourcesService,
  TagService,
  TransactionService,
  UserService,
  VaultService,
} from "@ndb/core";
import {
  InMemoryAccountRepository,
  InMemoryBackupArtifactStore,
  InMemoryBackupExportRepository,
  InMemoryCategoryRepository,
  InMemoryDashboardRepository,
  InMemoryJobRepository,
  InMemoryRuleGroupRepository,
  InMemoryRuleRepository,
  InMemorySourcesRepository,
  InMemoryTagRepository,
  InMemoryUserRepository,
  InMemoryVaultSlotRepository,
  InMemoryWebAuthnCredentialRepository,
  nullUserDataKeyLoader,
} from "@ndb/core/tests";
import { createInMemoryStatementEngine } from "@tests/api/fakes/in-memory-statement-engine";

export function createStatementsTestServices(
  accountRepository = new InMemoryAccountRepository(),
  options?: {
    vault?: VaultService;
    user?: UserService;
  }
) {
  const statements = {
    engine: createInMemoryStatementEngine(),
    trace: false,
  };
  const jobRepository = new InMemoryJobRepository();
  const jobRunner = new JobRunnerService(jobRepository, 2);
  const sourcesRepository = new InMemorySourcesRepository();
  const sources = new SourcesService(sourcesRepository);
  const job = new JobService(jobRepository, jobRunner);
  const categoryRepository = new InMemoryCategoryRepository();
  const tagRepository = new InMemoryTagRepository();
  const category = new CategoryService(categoryRepository);
  const tag = new TagService(tagRepository);
  const ruleGroupRepository = new InMemoryRuleGroupRepository();
  const ruleRepository = new InMemoryRuleRepository();
  const ruleGroup = new RuleGroupService(ruleGroupRepository, ruleRepository);
  const rule = new RuleService(ruleRepository, ruleGroupRepository);
  const account = new AccountService(
    accountRepository,
    sources,
    jobRunner,
    nullUserDataKeyLoader,
    statements
  );
  const transactionRepository = accountRepository.transactions;
  const transaction = new TransactionService(
    transactionRepository,
    accountRepository,
    categoryRepository,
    tagRepository,
    account
  );
  const ruleEngine = new RuleEngineService(
    ruleGroupRepository,
    ruleRepository,
    transactionRepository,
    accountRepository,
    categoryRepository,
    tagRepository
  );
  transaction.attachRuleEngine(ruleEngine);
  const dashboard = new DashboardService(
    new InMemoryDashboardRepository(transactionRepository, accountRepository, categoryRepository),
    accountRepository,
    transactionRepository
  );
  const ledgerIngest = new LedgerIngestService(
    statements,
    nullUserDataKeyLoader,
    account,
    accountRepository,
    transaction
  );
  account.attachLedgerIngest(ledgerIngest);
  const usersRepo = new InMemoryUserRepository();
  const vault =
    options?.vault ??
    new VaultService(
      usersRepo,
      new InMemoryVaultSlotRepository(),
      new InMemoryWebAuthnCredentialRepository(),
      {
        hash: async (plain) => plain,
        verify: async () => true,
      }
    );
  const user = options?.user ?? new UserService(usersRepo, { revoke: async () => undefined });
  const backup = new BackupService(
    jobRunner,
    jobRepository,
    new InMemoryBackupExportRepository(),
    account,
    accountRepository,
    sources,
    categoryRepository,
    tagRepository,
    ruleGroupRepository,
    ruleRepository,
    transactionRepository,
    transaction,
    vault,
    user,
    new InMemoryBackupArtifactStore(),
    false
  );

  return {
    account,
    category,
    tag,
    ruleGroup,
    rule,
    ruleEngine,
    transaction,
    dashboard,
    sources,
    sourcesRepository,
    job,
    jobRunner,
    accountRepository,
    categoryRepository,
    tagRepository,
    transactionRepository,
    backup,
  };
}
