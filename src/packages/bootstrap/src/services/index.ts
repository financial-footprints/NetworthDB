import type { AdvancedSecurityConfig, EncryptionConfig, JobsConfig } from "@bootstrap/config/api";
import type { AuthServices } from "@bootstrap/services/auth";
import {
  AccountService,
  type AppEnv,
  type AuthService,
  JobRunnerService,
  JobService,
  SourcesService,
  type StatementEngine,
  type StatementsRuntime,
  type UserDataKeyLoader,
  UserService,
  type VaultService,
} from "@ndb/core";
import type { DbClient } from "@ndb/database";
import {
  cryptography,
  DrizzleAccountRepository,
  DrizzleJobRepository,
  DrizzleSourcesRepository,
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
  health: HealthService;
  user: UserService;
  account: AccountService;
  sources: SourcesService;
  job: JobService;
  jobRunner: JobRunnerService;
  vault: VaultService;
  auth: AuthService;
};

type CreateApiServicesConfig = {
  app: {
    environment: AppEnv;
  };
  auth: AuthServices;
  jobs: JobsConfig;
  encryption: EncryptionConfig;
  advancedSecurity: AdvancedSecurityConfig;
};

export function createApiServices(
  db: DbClient,
  config: CreateApiServicesConfig,
  engine: StatementEngine
): ApiServices {
  const userRepository = new DrizzleUserRepository(db);
  const accountRepository = new DrizzleAccountRepository(db);
  const sourcesRepository = new DrizzleSourcesRepository(db);
  const jobRepository = new DrizzleJobRepository(db);
  const jobRunner = new JobRunnerService(jobRepository, config.jobs.workers);

  const user = new UserService(userRepository, config.auth.auth);
  const keys: UserDataKeyLoader = {
    ensure: (userId) =>
      config.encryption.enabled ? cryptography.ensureDataKey(db, userId) : Promise.resolve(null),
    get: (userId) =>
      config.encryption.enabled ? cryptography.loadDataKey(db, userId) : Promise.resolve(null),
  };
  const sources = new SourcesService(sourcesRepository);
  const statements: StatementsRuntime = {
    engine,
    pipelineTrace: config.advancedSecurity.pipelineTrace,
  };
  const account = new AccountService(accountRepository, sources, jobRunner, keys, statements);
  const job = new JobService(jobRepository, jobRunner);

  return {
    health: new HealthService(db),
    user,
    account,
    sources,
    job,
    jobRunner,
    vault: config.auth.vault,
    auth: config.auth.auth,
  };
}

export {
  type AuthServices,
  type CreateAuthServicesConfig,
  createAuthServices,
} from "@bootstrap/services/auth";
