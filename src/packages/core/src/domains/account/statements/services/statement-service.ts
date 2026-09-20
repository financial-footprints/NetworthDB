import { isSystemAccountType, supportsStatements } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import { ensureSystemAccounts } from "@core/domains/account/helpers";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { executeStatementJob } from "@core/domains/account/statements/embedded/statement-job";
import type { StatementsServices } from "@core/domains/account/statements/embedded/statements-services";
import { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import {
  type DownloadSourceFormat,
  StatementDownload,
} from "@core/domains/account/statements/entities/statement-download";
import { StatementUpload } from "@core/domains/account/statements/entities/statement-upload";
import type { Bank, StatementList } from "@core/domains/account/statements/types";
import type { LedgerIngestService } from "@core/domains/account/transactions/services/ledger-ingest-service";
import { assertAal2 } from "@core/domains/auth/helpers";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import type { User } from "@core/domains/user/entities/user/index";
import type { UserDataKeyLoader } from "@core/ports/encryption";
import {
  buildCalendarYearSections,
  type CalendarEndSource,
  type CalendarYearSection,
  resolveCalendarEnd,
} from "@core/shared/calendar";
import {
  ConflictError,
  EntityNotFoundError,
  ValidationError,
} from "@core/shared/errors/domain-error";

const MEDIA_TYPES: Record<DownloadSourceFormat, string> = {
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  transactions: "text/csv; charset=utf-8",
};

const EMPTY_STATEMENT_LIST: StatementList = {
  available: false,
  statementCount: 0,
  formats: [],
  coverage: {
    segments: [],
    gaps: [],
    months: [],
    periodCount: 0,
  },
  statements: [],
  balanceGaps: [],
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

const FORMAT_EXTENSIONS: Record<DownloadSourceFormat, string> = {
  pdf: ".pdf",
  csv: ".csv",
  zip: ".zip",
  txt: ".txt",
  transactions: ".csv",
};

export type DocumentInput = {
  accountId: string;
  statementDate: string;
  format: string;
};

export type DocumentResult = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

export type MetadataResult = {
  account: Account;
  calendarStart: string;
  calendarEnd: string;
  calendarEndSource: CalendarEndSource;
  closingDateConfigured: boolean;
  calendarYearSections: CalendarYearSection[];
  statements: StatementList;
};

export type UploadFileInput = {
  accountId: string;
  format: string;
  filename: string | null;
  content: Buffer;
  statementKind?: string;
  coveredMonth?: string | null;
  yearKey?: string | null;
};

export type UploadResult = {
  jobId: string;
};

export class StatementService {
  private ledgerIngest: LedgerIngestService | null = null;

  constructor(
    private readonly statements: StatementsServices,
    private readonly accounts: AccountRepository,
    private readonly runner: JobRunnerService,
    private readonly keys: UserDataKeyLoader
  ) {}

  attachLedgerIngest(ingest: LedgerIngestService): void {
    this.ledgerIngest = ingest;
  }

  listBanks(user: User, authAcr: string): Bank[] {
    assertAal2(user.multifactorEnabled, authAcr);
    return this.statements.engine.listBanks();
  }

  async getMetadata(user: User, authAcr: string, accountId: string): Promise<MetadataResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    await ensureSystemAccounts(this.accounts, user.id);
    const account = await this.requireAccount(user.id, accountId);
    if (!supportsStatements(account.accountType)) {
      const calendarEnd = resolveCalendarEnd(account.closingDate);
      return {
        account,
        calendarStart: account.openingDate,
        calendarEnd: calendarEnd.calendarEnd,
        calendarEndSource: calendarEnd.calendarEndSource,
        closingDateConfigured: calendarEnd.closingDateConfigured,
        calendarYearSections: buildCalendarYearSections(
          account.openingDate,
          calendarEnd.calendarEnd
        ),
        statements: EMPTY_STATEMENT_LIST,
      };
    }
    return this.readMetadata(user.id, account);
  }

  async download(user: User, authAcr: string, input: DocumentInput): Promise<DocumentResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    const account = await this.requireAccount(user.id, input.accountId);
    rejectNonStatement(account);
    return this.downloadForAccount(user.id, account, input);
  }

  async upload(user: User, authAcr: string, input: UploadFileInput): Promise<UploadResult> {
    assertAal2(user.multifactorEnabled, authAcr);
    const account = await this.requireAccount(user.id, input.accountId);
    rejectNonStatement(account);
    return this.uploadForAccount(user.id, account, input);
  }

  private async requireAccount(userId: string, accountId: string): Promise<Account> {
    const account = await this.accounts.findById(userId, accountId);
    if (!account) {
      throw new EntityNotFoundError("Account", accountId);
    }
    return account;
  }

  private async readMetadata(userId: string, account: Account): Promise<MetadataResult> {
    const calendarEnd = resolveCalendarEnd(account.closingDate);
    const dataKey = await this.keys.get(userId);

    return {
      account,
      calendarStart: account.openingDate,
      calendarEnd: calendarEnd.calendarEnd,
      calendarEndSource: calendarEnd.calendarEndSource,
      closingDateConfigured: calendarEnd.closingDateConfigured,
      calendarYearSections: buildCalendarYearSections(account.openingDate, calendarEnd.calendarEnd),
      statements: this.statements.engine.readAccountStatements({
        userId,
        dataKey,
        account,
      }),
    };
  }

  private async downloadForAccount(
    userId: string,
    account: Account,
    input: DocumentInput
  ): Promise<DocumentResult> {
    const download = StatementDownload.create(input);

    const dataKey = await this.keys.get(userId);
    const buffer = this.statements.engine.readStatementFile({
      userId,
      dataKey,
      accountType: account.accountType,
      accountId: account.id,
      format: download.format,
      statementDate: download.statementDate,
    });

    if (!buffer) {
      throw new EntityNotFoundError("StatementFile", download.statementDate, {
        accountId: account.id,
        format: download.format,
      });
    }

    const filename =
      download.format === "transactions"
        ? `transactions-${download.statementDate}.csv`
        : `${download.statementDate}${FORMAT_EXTENSIONS[download.format]}`;

    return {
      buffer,
      contentType: MEDIA_TYPES[download.format],
      filename,
    };
  }

  async setTransactionsSync(
    userId: string,
    account: Account,
    input: {
      period: string;
      transactionsSynced: boolean;
      transactionsImportId: string | null;
    }
  ): Promise<void> {
    rejectNonStatement(account);
    const dataKey = await this.keys.get(userId);
    this.statements.engine.setTransactionsSync({
      userId,
      dataKey,
      account,
      period: input.period,
      transactionsSynced: input.transactionsSynced,
      transactionsImportId: input.transactionsImportId,
    });
  }

  private async uploadForAccount(
    userId: string,
    account: Account,
    input: UploadFileInput
  ): Promise<UploadResult> {
    const upload = StatementUpload.create({
      format: input.format,
      filename: input.filename,
      statementKind: input.statementKind ?? "monthly",
      coveredMonth: input.coveredMonth,
      yearKey: input.yearKey,
    });

    const dataKey = await this.keys.ensure(userId);
    const filename = upload.filename;

    if (
      this.statements.engine.statementFileExists({
        userId,
        dataKey,
        accountType: account.accountType,
        accountId: account.id,
        format: upload.format,
        statementDate: upload.statementDate ?? undefined,
        filename,
      })
    ) {
      throw new ConflictError("A file already exists for that period.", {
        accountId: account.id,
        format: upload.format,
      });
    }

    await this.statements.engine.writeUpload({
      userId,
      dataKey,
      accountType: account.accountType,
      accountId: account.id,
      format: upload.format,
      statementDate: upload.statementDate ?? undefined,
      filename,
      data: input.content,
      passwords: [...account.passwords],
      bank: account.bank,
      variant: account.variant ?? null,
    });

    const scope = JobScope.create({ accountId: account.id });

    const job = await this.runner.submit(
      userId,
      "upload",
      scope,
      async (jobId, shouldCancel, appendLog) => {
        const record = await this.accounts.findById(userId, account.id);
        if (!record) {
          throw new Error("core.account.find.not-found");
        }

        const pipeline = PipelineRun.createUpload({
          jobId,
          userId,
          account: record,
          format: upload.format,
          statementDate: upload.statementDate,
          dataKey,
          trace: this.statements.trace,
        });

        const result = await executeStatementJob(
          pipeline,
          shouldCancel,
          appendLog,
          (cancel, onLogLine) => this.statements.engine.processUpload(pipeline, cancel, onLogLine),
          "statements.pipeline.upload.failed"
        );

        if (this.ledgerIngest) {
          const record = await this.accounts.findById(userId, account.id);
          if (record) {
            await this.ledgerIngest.ingestUnsyncedForAccount(userId, record, shouldCancel);
          }
        }

        return result;
      }
    );

    return { jobId: job.id };
  }

  async deleteArtifacts(userId: string, account: Account): Promise<void> {
    const dataKey = await this.keys.get(userId);
    const pipeline = PipelineRun.createDelete({
      jobId: "delete",
      userId,
      account,
      dataKey,
      trace: this.statements.trace,
    });
    const result = await this.statements.engine.deleteAccountStatements(pipeline);
    if (!result.ok) {
      throw new Error(result.reason ?? "statements.delete.failed");
    }
  }
}
