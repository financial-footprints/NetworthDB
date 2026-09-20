import {
  type AccountType,
  INSTRUMENT_ACCOUNT_TYPES,
  isSystemAccountType,
  SYSTEM_ACCOUNT_LABELS,
  SYSTEM_ACCOUNT_TYPES,
  supportsStatements,
} from "@core/domains/account/constants";
import { Account } from "@core/domains/account/entities/account";
import type { AccountListStatus } from "@core/domains/account/helpers";
import { ensureSystemAccounts } from "@core/domains/account/helpers";
import type {
  AccountListItem,
  AccountRepository,
  AccountSortColumn,
} from "@core/domains/account/repositories/account-repository";
import type { StatementsServices } from "@core/domains/account/statements/embedded/statements-services";
import { PipelineService } from "@core/domains/account/statements/services/pipeline-service";
import { StatementService } from "@core/domains/account/statements/services/statement-service";
import type { LedgerIngestService } from "@core/domains/account/transactions/services/ledger-ingest-service";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import type { SourcesService } from "@core/domains/sources/services/sources-service";
import type { User } from "@core/domains/user/entities/user/index";
import type { CreditCardTitleLookup } from "@core/ports/credit-card-titles";
import type { UserDataKeyLoader } from "@core/ports/encryption";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
import type { Sort } from "@core/shared/query";
import { Time } from "@core/shared/time";

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
  listStatus?: AccountListStatus;
  q?: string;
  sort?: Sort<AccountSortColumn>;
};

export type AccountListResult = {
  items: AccountListItem[];
  total: number;
};

export type SystemAccountItem = {
  id: string;
  label: string;
  accountType: AccountType;
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

function rejectSystem(account: Account): void {
  if (isSystemAccountType(account.accountType)) {
    throw new ValidationError("This operation is not allowed on system accounts.");
  }
}

export class AccountService {
  readonly statements: StatementService;
  readonly pipeline: PipelineService;

  constructor(
    private readonly accounts: AccountRepository,
    sources: SourcesService,
    jobRunner: JobRunnerService,
    keys: UserDataKeyLoader,
    statements: StatementsServices,
    private readonly cardTitles?: CreditCardTitleLookup
  ) {
    this.statements = new StatementService(statements, accounts, jobRunner, keys);
    this.pipeline = new PipelineService(accounts, sources, jobRunner, keys, statements);
  }

  attachLedgerIngest(ingest: LedgerIngestService): void {
    this.statements.attachLedgerIngest(ingest);
    this.pipeline.attachLedgerIngest(ingest);
  }

  private async catalogLabel(
    accountType: AccountType,
    bank: string,
    variant: string | null | undefined
  ): Promise<string | undefined> {
    if (accountType !== "credit_card" || !this.cardTitles) {
      return undefined;
    }
    const title = await this.cardTitles.title(bank, variant);
    const trimmed = title?.trim();
    return trimmed ? trimmed : undefined;
  }

  private async _get(userId: string, accountId: string): Promise<Account> {
    const account = await this.accounts.findById(userId, accountId);
    if (!account) {
      throw new EntityNotFoundError("Account", accountId);
    }

    return account;
  }

  async ensureSystemAccounts(userId: string): Promise<void> {
    await ensureSystemAccounts(this.accounts, userId);
  }

  async listSystemAccounts(user: User, authAcr: string): Promise<SystemAccountItem[]> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.ensureSystemAccounts(user.id);
    const items = await this.accounts.findByFilters({
      userId: user.id,
      accountTypes: SYSTEM_ACCOUNT_TYPES,
    });
    return SYSTEM_ACCOUNT_TYPES.map((accountType) => {
      const account = items.find((row) => row.accountType === accountType);
      if (!account) {
        throw new EntityNotFoundError("Account", String(accountType), { accountType });
      }
      return {
        id: account.id,
        label: SYSTEM_ACCOUNT_LABELS[accountType],
        accountType,
      };
    });
  }

  async mapById(userId: string): Promise<Map<string, Account>> {
    const rows = await this.accounts.findByFilters({ userId });
    return new Map(rows.map((account) => [account.id, account]));
  }

  async create(user: User, authAcr: string, input: CreateAccountInput): Promise<Account> {
    assertAal2(user.multifactorEnabled, authAcr);
    if (isSystemAccountType(input.accountType)) {
      throw new ValidationError("This operation is not allowed on system accounts.");
    }

    const label = await this.catalogLabel(input.accountType, input.bank, input.variant);
    const account = Account.create({
      userId: user.id,
      accountType: input.accountType,
      bank: input.bank,
      variant: input.variant,
      label,
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

    const listStatus = query.listStatus ?? "open";
    const filters = {
      userId: user.id,
      accountType: query.accountType,
      accountTypes: query.accountType ? undefined : INSTRUMENT_ACCOUNT_TYPES,
      listStatus,
      asOfIsoDate: Time.utcTodayIsoDate(),
      q: query.q,
    };

    const sort: Sort<AccountSortColumn> = query.sort ?? { column: "label", direction: "asc" };

    const [items, total] = await Promise.all([
      this.accounts.listWithBalances(filters, sort),
      this.accounts.aggregate(filters),
    ]);

    return { items, total };
  }

  async get(user: User, authAcr: string, accountId: string): Promise<Account> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.ensureSystemAccounts(user.id);
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
    rejectSystem(existing);
    if (input.accountType !== undefined && isSystemAccountType(input.accountType)) {
      throw new ValidationError("This operation is not allowed on system accounts.");
    }

    const nextType = input.accountType ?? existing.accountType;
    const nextBank = input.bank ?? existing.bank;
    const nextVariant = input.variant !== undefined ? input.variant : existing.variant;
    const label = await this.catalogLabel(nextType, nextBank, nextVariant);
    const updated = existing.withUpdates({
      accountType: input.accountType,
      bank: input.bank,
      variant: input.variant,
      label,
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
    rejectSystem(account);
    if (supportsStatements(account.accountType)) {
      await this.statements.deleteArtifacts(user.id, account);
    }
    await this.accounts.delete({ id: accountId, userId: user.id });
  }
}
