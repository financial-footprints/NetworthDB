import type { AccountType } from "@core/domains/account/constants";
import { Account } from "@core/domains/account/entities/account";
import type { StatementsRuntime } from "@core/domains/account/modules/statements/embedded/pipeline-context";
import {
  PipelineService,
  type StatementSyncInput,
  type StatementSyncResult,
} from "@core/domains/account/modules/statements/services/pipeline-service";
import {
  type DocumentInput,
  type DocumentResult,
  type MetadataResult,
  StatementService,
  type UploadFileInput,
  type UploadResult,
} from "@core/domains/account/modules/statements/services/statement-service";
import type { Bank } from "@core/domains/account/modules/statements/types";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import type { SourcesService } from "@core/domains/sources/services/sources-service";
import type { User } from "@core/domains/user/entities/user/index";
import type { UserDataKeyLoader } from "@core/ports/encryption";
import { EntityNotFoundError } from "@core/shared/errors/domain-error";

export type MailMatchInput = {
  subjects?: string[];
  bodyContains?: string[];
  fromAddresses?: string[];
};

export type StatementCleanupInput = {
  textContains?: string[];
  textNotContains?: string[];
};

export type CreateAccountInput = {
  bank: string;
  variant?: string | null;
  accountType: AccountType;
  openingDate: string;
  closingDate?: string | null;
  accountNumber: string;
  passwords: string[];
  mail?: MailMatchInput | null;
  statement?: StatementCleanupInput | null;
};

export type UpdateAccountInput = {
  bank?: string;
  variant?: string | null;
  accountType?: AccountType;
  openingDate?: string;
  closingDate?: string | null;
  accountNumber?: string;
  passwords?: string[];
  mail?: MailMatchInput | null;
  statement?: StatementCleanupInput | null;
};

export type AccountListQuery = {
  accountType?: AccountType;
};

export type AccountListResult = {
  items: Account[];
  total: number;
};

function mailFromInput(mail: MailMatchInput | null | undefined): Account["mail"] {
  if (mail === undefined || mail === null) {
    return null;
  }

  return {
    subjects: mail.subjects ?? [],
    bodyContains: mail.bodyContains ?? [],
    fromAddresses: mail.fromAddresses ?? [],
  };
}

function statementFromInput(
  statement: StatementCleanupInput | null | undefined
): Account["statement"] {
  if (statement === undefined || statement === null) {
    return null;
  }

  return {
    textContains: statement.textContains ?? [],
    textNotContains: statement.textNotContains ?? [],
  };
}

export class AccountService {
  private readonly statements: StatementService;
  private readonly pipeline: PipelineService;

  constructor(
    private readonly accounts: AccountRepository,
    sources: SourcesService,
    jobRunner: JobRunnerService,
    keys: UserDataKeyLoader,
    statements: StatementsRuntime
  ) {
    this.statements = new StatementService(statements, accounts, jobRunner, keys);
    this.pipeline = new PipelineService(accounts, sources, jobRunner, keys, statements);
  }

  private async _get(userId: string, accountId: string): Promise<Account> {
    const account = await this.accounts.findById(userId, accountId);
    if (!account) {
      throw new EntityNotFoundError("core.account.find.not-found", {
        entityName: "Account",
        id: accountId,
      });
    }

    return account;
  }

  async create(user: User, authAcr: string, input: CreateAccountInput): Promise<Account> {
    assertAal2(user.multifactorEnabled, authAcr);

    const account = Account.create({
      userId: user.id,
      accountType: input.accountType,
      bank: input.bank,
      variant: input.variant,
      openingDate: input.openingDate,
      closingDate: input.closingDate,
      accountNumber: input.accountNumber,
      passwords: input.passwords,
      mail: mailFromInput(input.mail),
      statement: statementFromInput(input.statement),
    });

    return this.accounts.create(account);
  }

  async list(user: User, authAcr: string, query: AccountListQuery): Promise<AccountListResult> {
    assertAal2(user.multifactorEnabled, authAcr);

    const filters = {
      userId: user.id,
      accountType: query.accountType,
    };

    const items = await this.accounts.findByFilters(filters, { column: "label", direction: "asc" });
    const total = await this.accounts.aggregate(filters);

    return { items, total };
  }

  async get(user: User, authAcr: string, accountId: string): Promise<Account> {
    assertAal2(user.multifactorEnabled, authAcr);
    return this._get(user.id, accountId);
  }

  async update(
    user: User,
    authAcr: string,
    accountId: string,
    input: UpdateAccountInput
  ): Promise<Account> {
    assertAal2(user.multifactorEnabled, authAcr);

    const existing = await this._get(user.id, accountId);

    const updated = existing.withUpdates({
      accountType: input.accountType,
      bank: input.bank,
      variant: input.variant,
      openingDate: input.openingDate,
      closingDate: input.closingDate,
      accountNumber: input.accountNumber,
      passwords: input.passwords,
      mail: input.mail !== undefined ? mailFromInput(input.mail) : undefined,
      statement: input.statement !== undefined ? statementFromInput(input.statement) : undefined,
      updatedAt: new Date().toISOString(),
    });

    return this.accounts.save(updated);
  }

  async delete(user: User, authAcr: string, accountId: string): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    const account = await this._get(user.id, accountId);
    await this.statements.deleteArtifacts(user.id, account);
    await this.accounts.delete({ id: accountId, userId: user.id });
  }

  async listBanks(user: User, authAcr: string): Promise<Bank[]> {
    assertAal2(user.multifactorEnabled, authAcr);
    return this.statements.listBanks();
  }

  async getStatementMetadata(
    user: User,
    authAcr: string,
    accountId: string
  ): Promise<MetadataResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    const account = await this._get(user.id, accountId);
    return this.statements.getMetadata(user.id, account);
  }

  async downloadStatement(
    user: User,
    authAcr: string,
    input: DocumentInput
  ): Promise<DocumentResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    const account = await this._get(user.id, input.accountId);
    return this.statements.download(user.id, account, input);
  }

  async uploadStatement(
    user: User,
    authAcr: string,
    input: UploadFileInput
  ): Promise<UploadResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    const account = await this._get(user.id, input.accountId);
    return this.statements.upload(user.id, account, input);
  }

  async syncStatements(
    user: User,
    authAcr: string,
    input: StatementSyncInput = {}
  ): Promise<StatementSyncResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    return this.pipeline.sync(user, authAcr, input);
  }
}
