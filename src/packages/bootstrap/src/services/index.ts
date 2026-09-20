import { FsBackupArtifactStore } from "@bootstrap/adapters/fs-backup-artifact-store";
import type { AdvancedSecurityConfig, EncryptionConfig, JobsConfig } from "@bootstrap/config/api";
import type { AuthServices } from "@bootstrap/services/auth";
import { createCreditCardTitleLookup } from "@bootstrap/services/credit-card-titles";
import {
  AccountService,
  type AppEnv,
  type AuthService,
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
  type StatementEngine,
  type StatementsServices,
  TagService,
  TransactionService,
  type UserDataKeyLoader,
  UserService,
  type VaultService,
} from "@ndb/core";
import type { DbClient } from "@ndb/database";
import {
  createCryptography,
  DrizzleAccountRepository,
  DrizzleBackupExportRepository,
  DrizzleCategoryRepository,
  DrizzleDashboardRepository,
  DrizzleJobRepository,
  DrizzleRuleGroupRepository,
  DrizzleRuleRepository,
  DrizzleSourcesRepository,
  DrizzleTagRepository,
  DrizzleUserRepository,
  pingDb,
} from "@ndb/database";

export type HealthStatus = {
  ok: boolean;
};

export class HealthService {
  constructor(private readonly db: DbClient) {}

  async check(): Promise<HealthStatus> {
    return { ok: await pingDb(this.db) };
  }
}

export type ApiServices = {
  healthService: HealthService;
  userService: UserService;
  accountService: AccountService;
  categoryService: CategoryService;
  tagService: TagService;
  ruleGroupService: RuleGroupService;
  ruleService: RuleService;
  ruleEngineService: RuleEngineService;
  transactionService: TransactionService;
  dashboardService: DashboardService;
  sourcesService: SourcesService;
  jobService: JobService;
  jobRunnerService: JobRunnerService;
  vaultService: VaultService;
  authService: AuthService;
  backupService: BackupService;
};

export type CreateApiServicesConfig = {
  app: {
    environment: AppEnv;
  };
  auth: AuthServices;
  jobs: JobsConfig;
  encryption: EncryptionConfig;
  advancedSecurity: AdvancedSecurityConfig;
  filestore: {
    path: string;
  };
};

export function createApiServices(
  db: DbClient,
  config: CreateApiServicesConfig,
  engine: StatementEngine
): ApiServices {
  const crypto = createCryptography();
  const userRepository = new DrizzleUserRepository(db);
  const accountRepository = new DrizzleAccountRepository(db, crypto);
  const transactionRepository = accountRepository.transactions;
  const categoryRepository = new DrizzleCategoryRepository(db);
  const tagRepository = new DrizzleTagRepository(db);
  const ruleGroupRepository = new DrizzleRuleGroupRepository(db);
  const ruleRepository = new DrizzleRuleRepository(db);
  const sourcesRepository = new DrizzleSourcesRepository(db, crypto);
  const jobRepository = new DrizzleJobRepository(db, crypto);
  const jobRunner = new JobRunnerService(jobRepository, config.jobs.workers);

  const user = new UserService(userRepository, config.auth.auth);
  const keys: UserDataKeyLoader = {
    ensure: (userId) =>
      config.encryption.enabled ? crypto.ensureDataKey(db, userId) : Promise.resolve(null),
    get: (userId) =>
      config.encryption.enabled ? crypto.loadDataKey(db, userId) : Promise.resolve(null),
  };
  const sources = new SourcesService(sourcesRepository);
  const statements: StatementsServices = {
    engine,
    trace: config.advancedSecurity.pipelineTrace,
  };
  const account = new AccountService(
    accountRepository,
    sources,
    jobRunner,
    keys,
    statements,
    createCreditCardTitleLookup()
  );
  const category = new CategoryService(categoryRepository);
  const tag = new TagService(tagRepository);
  const ruleGroup = new RuleGroupService(ruleGroupRepository, ruleRepository);
  const rule = new RuleService(ruleRepository, ruleGroupRepository);
  const transaction = new TransactionService(
    transactionRepository,
    accountRepository,
    categoryRepository,
    tagRepository,
    account
  );
  const dashboard = new DashboardService(
    new DrizzleDashboardRepository(db),
    accountRepository,
    transactionRepository
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
  const ledgerIngest = new LedgerIngestService(
    statements,
    keys,
    account,
    accountRepository,
    transaction
  );
  account.attachLedgerIngest(ledgerIngest);
  const job = new JobService(jobRepository, jobRunner);
  const backupExports = new DrizzleBackupExportRepository(db);
  const backupArtifacts = new FsBackupArtifactStore(config.filestore.path);
  const backup = new BackupService(
    jobRunner,
    jobRepository,
    backupExports,
    account,
    accountRepository,
    sources,
    categoryRepository,
    tagRepository,
    ruleGroupRepository,
    ruleRepository,
    transactionRepository,
    transaction,
    config.auth.vault,
    user,
    backupArtifacts,
    config.advancedSecurity.sensitiveBackups
  );

  return {
    healthService: new HealthService(db),
    userService: user,
    accountService: account,
    categoryService: category,
    tagService: tag,
    ruleGroupService: ruleGroup,
    ruleService: rule,
    ruleEngineService: ruleEngine,
    transactionService: transaction,
    dashboardService: dashboard,
    sourcesService: sources,
    jobService: job,
    jobRunnerService: jobRunner,
    vaultService: config.auth.vault,
    authService: config.auth.auth,
    backupService: backup,
  };
}

export {
  type AuthServices,
  type CreateAuthServicesConfig,
  createAuthServices,
} from "@bootstrap/services/auth";
