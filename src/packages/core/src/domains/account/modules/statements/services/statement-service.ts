import type { Account } from "@core/domains/account/entities/account";
import {
  createPipelineContext,
  type StatementsRuntime,
} from "@core/domains/account/modules/statements/embedded/pipeline-context";
import { executeStatementJob } from "@core/domains/account/modules/statements/embedded/statement-job";
import {
  type DownloadSourceFormat,
  StatementDownload,
} from "@core/domains/account/modules/statements/entities/statement-download";
import { StatementUpload } from "@core/domains/account/modules/statements/entities/statement-upload";
import type { Bank, StatementList } from "@core/domains/account/modules/statements/types";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import type { UserDataKeyLoader } from "@core/ports/encryption";
import {
  buildCalendarYearSections,
  type CalendarEndSource,
  type CalendarYearSection,
  resolveCalendarEnd,
} from "@core/shared/calendar";
import { ConflictError, EntityNotFoundError } from "@core/shared/errors/domain-error";

const MEDIA_TYPES: Record<DownloadSourceFormat, string> = {
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
};

const FORMAT_EXTENSIONS: Record<DownloadSourceFormat, string> = {
  pdf: ".pdf",
  csv: ".csv",
  zip: ".zip",
  txt: ".txt",
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
  constructor(
    private readonly statements: StatementsRuntime,
    private readonly accounts: AccountRepository,
    private readonly runner: JobRunnerService,
    private readonly keys: UserDataKeyLoader
  ) {}

  listBanks(): Bank[] {
    return this.statements.engine.listBanks();
  }

  async getMetadata(userId: string, account: Account): Promise<MetadataResult> {
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

  async download(userId: string, account: Account, input: DocumentInput): Promise<DocumentResult> {
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
      throw new EntityNotFoundError("core.account.files.download.error.not-found", {
        accountId: account.id,
        statementDate: download.statementDate,
        format: download.format,
      });
    }

    return {
      buffer,
      contentType: MEDIA_TYPES[download.format],
      filename: `${download.statementDate}${FORMAT_EXTENSIONS[download.format]}`,
    };
  }

  async upload(userId: string, account: Account, input: UploadFileInput): Promise<UploadResult> {
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
      throw new ConflictError("core.account.files.upload.conflict.file-exists", {
        accountId: account.id,
        format: upload.format,
      });
    }

    this.statements.engine.writeUpload({
      userId,
      dataKey,
      accountType: account.accountType,
      accountId: account.id,
      format: upload.format,
      statementDate: upload.statementDate ?? undefined,
      filename,
      data: input.content,
      passwords: [...account.passwords],
    });

    const scope = JobScope.create({ accountId: account.id });

    const job = await this.runner.submit(userId, "upload", scope, async (jobId, shouldCancel) => {
      const record = await this.accounts.findById(userId, account.id);
      if (!record) {
        throw new Error("core.account.find.not-found");
      }

      const context = createPipelineContext({
        userId,
        jobScope: scope,
        accounts: [record],
        sources: [],
      });

      return executeStatementJob(
        this.statements,
        jobId,
        shouldCancel,
        (options) =>
          this.statements.engine.processUpload(
            context,
            account.id,
            upload.format,
            upload.statementDate,
            dataKey,
            options
          ),
        "statements.pipeline.upload.failed"
      );
    });

    return { jobId: job.id };
  }

  async deleteArtifacts(userId: string, account: Account): Promise<void> {
    const dataKey = await this.keys.get(userId);
    const result = await this.statements.engine.deleteAccountStatements(
      createPipelineContext({
        userId,
        jobScope: JobScope.create({ accountId: account.id }),
        accounts: [account],
        sources: [],
      }),
      account.id,
      dataKey
    );
    if (!result.ok) {
      throw new Error(result.reason ?? "statements.delete.failed");
    }
  }
}
