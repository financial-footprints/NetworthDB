import { rm } from "node:fs/promises";
import {
  type ParsedBackupAccount,
  parseBackupAccountEntry,
  serializeAccountForBackup,
} from "@core/domains/account/backup/account-backup-map";
import {
  parseBackupProfile,
  serializeBackupProfile,
} from "@core/domains/account/backup/archive/profile";
import { parseVaultFile, serializeVaultSlots } from "@core/domains/account/backup/archive/vault";
import { parseSourcesWrite } from "@core/domains/account/backup/backup-archive-rows";
import {
  collectBackupTransactionRows,
  mapBackupTransactionForImport,
} from "@core/domains/account/backup/backup-import-transactions";
import {
  ACCOUNTS_JSON_NAME,
  BACKUP_FORMAT,
  BACKUP_JSONL_CHUNK,
  BACKUP_ZIP_PASSWORD_MIN_LEN,
  CATEGORIES_JSON_NAME,
  IMPORTS_JSONL_NAME,
  MANIFEST_JSON_NAME,
  PROFILE_JSON_NAME,
  RULE_GROUPS_JSON_NAME,
  RULES_JSON_NAME,
  SOURCES_JSON_NAME,
  SYSTEM_ACCOUNTS_JSON_NAME,
  TAGS_JSON_NAME,
  TRANSACTIONS_JSONL_NAME,
  VAULT_JSON_NAME,
} from "@core/domains/account/backup/constants";
import { BackupExport } from "@core/domains/account/backup/entities/backup-export";
import { findExistingAccountId } from "@core/domains/account/backup/match-account";
import type {
  BackupArtifactStore,
  BackupExportFiles,
  BackupImportFiles,
} from "@core/domains/account/backup/ports/backup-archive";
import type { BackupExportRepository } from "@core/domains/account/backup/repositories/backup-export-repository";
import {
  INSTRUMENT_ACCOUNT_TYPES,
  isInstrumentAccountType,
  isSystemAccountType,
  type SystemAccountType,
} from "@core/domains/account/constants";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { parseActionsJson, parseWhenJson } from "@core/domains/account/rules/embedded/helpers";
import type { RuleAction, RuleExpression } from "@core/domains/account/rules/embedded/types";
import { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import type { RuleGroupRepository } from "@core/domains/account/rules/repositories/rule-group-repository";
import type { RuleRepository } from "@core/domains/account/rules/repositories/rule-repository";
import type { AccountService } from "@core/domains/account/services/account-service";
import type { StatementWarning } from "@core/domains/account/statements/types";
import { Category } from "@core/domains/account/taxonomy/entities/category";
import { Tag } from "@core/domains/account/taxonomy/entities/tag";
import type { CategoryRepository } from "@core/domains/account/taxonomy/repositories/category-repository";
import type { TagRepository } from "@core/domains/account/taxonomy/repositories/tag-repository";
import type { Transaction } from "@core/domains/account/transactions/entities/transaction";
import { TransactionImport } from "@core/domains/account/transactions/entities/transaction-import";
import type {
  TransactionCursor,
  TransactionRepository,
} from "@core/domains/account/transactions/repositories/transaction-repository";
import type { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import { assertAal2 } from "@core/domains/auth/helpers";
import { JobExecutionError } from "@core/domains/jobs/embedded/output";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import type { JobRepository } from "@core/domains/jobs/repositories/job-repository";
import type { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { emailHasPassword, type Source } from "@core/domains/sources/entities/sources";
import type { SourcesService } from "@core/domains/sources/services/sources-service";
import type { User } from "@core/domains/user/entities/user/index";
import type { UserService } from "@core/domains/user/services/user-service";
import type { VaultService } from "@core/domains/user/vault/services/vault-service";
import {
  ConflictError,
  EntityNotFoundError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { Time } from "@core/shared/time";

function requireZipPassword(password: string | undefined): string {
  const trimmed = password?.trim() ?? "";
  if (trimmed.length < BACKUP_ZIP_PASSWORD_MIN_LEN) {
    throw new ValidationError("Password is too short.", { field: "password" });
  }
  return trimmed;
}

function backupWarning(kind: string, message: string, sourceFile: string): StatementWarning {
  return {
    kind,
    message,
    account: "",
    sourceFile,
    textContains: [],
  };
}

function utcBackupFilename(): string {
  const day = new Date().toISOString().slice(0, 10);
  return `networthdb-backup-${day}.zip`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function serializeSourceForBackup(
  source: Source,
  includeSecrets: boolean
): Record<string, unknown> {
  if (source.type === "thunderbird") {
    return {
      id: source.id,
      type: source.type,
      label: source.label,
      profile: source.profile,
    };
  }

  const base = {
    id: source.id,
    type: source.type,
    label: source.label,
    host: source.host || "",
    port: source.port ?? 993,
    username: source.username || "",
    folder: source.folder || "INBOX",
    use_ssl: source.useSsl ?? true,
  };

  if (includeSecrets) {
    return { ...base, password: source.password ?? "" };
  }

  return { ...base, has_password: emailHasPassword(source) };
}

type BackupCategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

type BackupTagRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type BackupRuleGroupRow = {
  id: string;
  sort_order: number;
  active: boolean;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type BackupRuleRow = {
  id: string;
  group_id: string;
  sort_order: number;
  active: boolean;
  stop_processing: boolean;
  run_on_create: boolean;
  title: string;
  description: string | null;
  when: unknown;
  actions: unknown;
  created_at: string;
  updated_at: string;
};

type BackupRemapMaps = {
  accountIdMap: Map<string, string>;
  categoryIdMap: Map<string, string>;
  tagIdMap: Map<string, string>;
  importIdMap: Map<string, string>;
};

function remapRequiredId(map: Map<string, string>, id: string): string {
  return map.get(id) ?? id;
}

function remapOptionalCategoryId(map: Map<string, string>, id: string | null): string | null {
  if (id === null) {
    return null;
  }
  return map.get(id) ?? null;
}

function remapTagIdList(map: Map<string, string>, ids: string[]): string[] {
  return ids.map((id) => map.get(id)).filter((id): id is string => id !== undefined);
}

function remapWhen(expression: RuleExpression, maps: BackupRemapMaps): RuleExpression {
  if ("op" in expression) {
    return {
      op: expression.op,
      items: expression.items.map((item) => remapWhen(item, maps)),
    };
  }
  switch (expression.type) {
    case "source_account_is":
    case "source_account_is_not":
    case "destination_account_is":
    case "destination_account_is_not":
    case "either_account_is":
    case "either_account_is_not":
      return { ...expression, accountId: remapRequiredId(maps.accountIdMap, expression.accountId) };
    case "category_is":
    case "category_is_not":
      return {
        ...expression,
        categoryId: remapRequiredId(maps.categoryIdMap, expression.categoryId),
      };
    case "subcategory_is":
    case "subcategory_is_not":
      return {
        ...expression,
        subcategoryId: remapRequiredId(maps.categoryIdMap, expression.subcategoryId),
      };
    case "tag_is":
    case "tag_is_not":
      return { ...expression, tagId: remapRequiredId(maps.tagIdMap, expression.tagId) };
    case "import_id_is":
      return { ...expression, importId: remapRequiredId(maps.importIdMap, expression.importId) };
    default:
      return expression;
  }
}

function remapActions(actions: RuleAction[], maps: BackupRemapMaps): RuleAction[] {
  return actions.map((action) => {
    switch (action.type) {
      case "set_category":
        return {
          ...action,
          categoryId: remapRequiredId(maps.categoryIdMap, action.categoryId),
          subcategoryId: remapOptionalCategoryId(maps.categoryIdMap, action.subcategoryId),
        };
      case "add_tag":
      case "remove_tag":
        return { ...action, tagId: remapRequiredId(maps.tagIdMap, action.tagId) };
      case "set_tags":
        return { ...action, tagIds: remapTagIdList(maps.tagIdMap, action.tagIds) };
      case "set_source_account":
      case "set_destination_account":
        return { ...action, accountId: remapRequiredId(maps.accountIdMap, action.accountId) };
      default:
        return action;
    }
  });
}

function parseRuleGroupRows(raw: string | undefined): BackupRuleGroupRow[] {
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new JobExecutionError("Rule groups file is invalid.");
  }
  return parsed as BackupRuleGroupRow[];
}

function parseRuleRows(raw: string | undefined): BackupRuleRow[] {
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new JobExecutionError("Rules file is invalid.");
  }
  return parsed as BackupRuleRow[];
}

type BackupImportRow = {
  id: string;
  account_id: string;
  created_at: string;
};

function parseSystemAccounts(
  raw: string
): Array<{ id: string; account_type: SystemAccountType; label: string }> {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new JobExecutionError("System accounts file is invalid.");
  }
  return parsed.map((row) => {
    if (typeof row !== "object" || row === null) {
      throw new JobExecutionError("System accounts file has an invalid entry.");
    }
    const entry = row as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    const accountType = entry.account_type;
    const label = typeof entry.label === "string" ? entry.label : "";
    if (!id || typeof accountType !== "string" || !isSystemAccountType(accountType)) {
      throw new JobExecutionError("System accounts file has an invalid entry.");
    }
    return { id, account_type: accountType, label };
  });
}

function parseCategoryRows(raw: string | undefined): BackupCategoryRow[] {
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new JobExecutionError("Categories file is invalid.");
  }
  return parsed as BackupCategoryRow[];
}

function parseTagRows(raw: string | undefined): BackupTagRow[] {
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new JobExecutionError("Tags file is invalid.");
  }
  return parsed as BackupTagRow[];
}

function parseImportRow(raw: unknown): BackupImportRow {
  if (typeof raw !== "object" || raw === null) {
    throw new JobExecutionError("Imports file has an invalid entry.");
  }
  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === "string" ? entry.id : "";
  const accountId = typeof entry.account_id === "string" ? entry.account_id : "";
  const createdAt = typeof entry.created_at === "string" ? entry.created_at : "";
  if (!id || !accountId || !createdAt) {
    throw new JobExecutionError("Imports file has an invalid entry.");
  }
  return { id, account_id: accountId, created_at: createdAt };
}

function sortCategoriesForImport(rows: BackupCategoryRow[]): BackupCategoryRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const depth = (row: BackupCategoryRow): number => {
    if (!row.parent_id) {
      return 0;
    }
    const parent = byId.get(row.parent_id);
    return parent ? 1 + depth(parent) : 1;
  };
  return [...rows].sort((a, b) => depth(a) - depth(b));
}

export class BackupService {
  constructor(
    private readonly jobRunner: JobRunnerService,
    private readonly jobs: JobRepository,
    private readonly exports: BackupExportRepository,
    private readonly accountService: AccountService,
    private readonly accounts: AccountRepository,
    private readonly sources: SourcesService,
    private readonly categories: CategoryRepository,
    private readonly tags: TagRepository,
    private readonly ruleGroups: RuleGroupRepository,
    private readonly rules: RuleRepository,
    private readonly transactions: TransactionRepository,
    private readonly transactionService: TransactionService,
    private readonly vault: VaultService,
    private readonly users: UserService,
    private readonly artifacts: BackupArtifactStore,
    private readonly includeSecrets: boolean
  ) {}

  async exportBackup(user: User, authAcr: string, password: string): Promise<{ jobId: string }> {
    assertAal2(user.multifactorEnabled, authAcr);
    const zipPassword = requireZipPassword(password);
    await this.assertNoActiveBackupJob(user.id);

    const job = await this.jobRunner.submit(
      user.id,
      "backup_export",
      JobScope.empty(),
      async (jobId, shouldCancel) => {
        if (shouldCancel()) {
          throw new JobExecutionError("Backup export was cancelled.");
        }

        let stagingWritten = false;
        try {
          await this.accountService.ensureSystemAccounts(user.id);
          const workspace = await this.artifacts.createExportWorkspace();
          await this.writeExportStaticJson(workspace, user, authAcr);
          await this.streamExportImportsAndTransactions(workspace, user, shouldCancel);
          const backup = await this.finalizeExportArtifact(user, jobId, workspace, zipPassword);
          stagingWritten = true;
          return {
            output: {
              warnings: [],
              backup,
            },
          };
        } catch (error) {
          if (stagingWritten) {
            await this.artifacts.deleteArtifact(user.id, jobId);
          }
          throw error;
        }
      }
    );

    return { jobId: job.id };
  }

  async importBackup(
    user: User,
    authAcr: string,
    zipPath: string,
    password: string
  ): Promise<{ jobId: string }> {
    assertAal2(user.multifactorEnabled, authAcr);
    const zipPassword = requireZipPassword(password);
    await this.assertNoActiveBackupJob(user.id);

    const job = await this.jobRunner.submit(
      user.id,
      "backup_import",
      JobScope.empty(),
      async (_jobId, shouldCancel) => {
        try {
          if (shouldCancel()) {
            throw new JobExecutionError("Backup import was cancelled.");
          }
          const archive = await this.readAndValidateImportArchive(zipPath, zipPassword);
          const vaultOutcome = await this.importVaultFromBackup(user, archive.vaultRaw);
          const result = await this.runImportPipeline(
            user,
            authAcr,
            archive,
            vaultOutcome,
            shouldCancel
          );
          return { output: result };
        } finally {
          if (!zipPath.startsWith("memory:")) {
            await rm(zipPath, { force: true });
          }
        }
      }
    );

    return { jobId: job.id };
  }

  async getExportStatus(
    user: User,
    authAcr: string
  ): Promise<{
    current: {
      filename: string;
      bytes: number;
      createdAt: Date;
      expiresAt: Date;
    } | null;
    activeJobId: string | null;
    activeImportJobId: string | null;
  }> {
    assertAal2(user.multifactorEnabled, authAcr);
    const currentRow = await this.loadCurrentExport(user.id);
    const [activeJobId, activeImportJobId] = await Promise.all([
      this.findActiveExportJobId(user.id),
      this.findActiveImportJobId(user.id),
    ]);
    return {
      current: currentRow
        ? {
            filename: currentRow.filename,
            bytes: currentRow.bytes,
            createdAt: currentRow.createdAt,
            expiresAt: currentRow.expiresAt,
          }
        : null,
      activeJobId,
      activeImportJobId,
    };
  }

  async downloadCurrentExport(
    user: User,
    authAcr: string
  ): Promise<{ filename: string; path?: string; bytes?: Uint8Array }> {
    assertAal2(user.multifactorEnabled, authAcr);
    const current = await this.loadCurrentExport(user.id);
    if (!current) {
      throw new EntityNotFoundError("BackupExport", user.id);
    }
    const artifact = await this.artifacts.readArtifact(user.id, current.jobId);
    return { filename: current.filename, path: artifact.path, bytes: artifact.bytes };
  }

  async purgeExpiredExports(now: Date = new Date()): Promise<number> {
    const expired = await this.exports.findExpired(now);
    for (const row of expired) {
      await this.artifacts.deleteArtifact(row.userId, row.jobId);
      await this.exports.deleteByUserId(row.userId);
    }
    return expired.length;
  }

  private async writeExportStaticJson(
    workspace: BackupExportFiles,
    user: User,
    authAcr: string
  ): Promise<void> {
    await workspace.writeJson(MANIFEST_JSON_NAME, {
      format: BACKUP_FORMAT,
      created_at: new Date().toISOString(),
    });

    const vaultState = await this.vault.get(user.id);
    await workspace.writeJson(VAULT_JSON_NAME, serializeVaultSlots(vaultState.vaultSlots));
    const clientSettings = await this.users.getClientSettings(user.id);
    await workspace.writeJson(
      PROFILE_JSON_NAME,
      serializeBackupProfile(vaultState.displayName, clientSettings)
    );

    const instruments = await this.accounts.findByFilters({
      userId: user.id,
      accountTypes: INSTRUMENT_ACCOUNT_TYPES,
      listStatus: "all",
    });
    await workspace.writeJson(
      ACCOUNTS_JSON_NAME,
      instruments.map((account) => serializeAccountForBackup(account, this.includeSecrets))
    );

    const systemAccounts = await this.accountService.listSystemAccounts(user, authAcr);
    await workspace.writeJson(
      SYSTEM_ACCOUNTS_JSON_NAME,
      systemAccounts.map((row) => ({
        id: row.id,
        account_type: row.accountType,
        label: row.label,
      }))
    );

    const sourcePayload = await this.sources.getSources(user, authAcr);
    if (sourcePayload.sources.length > 0) {
      await workspace.writeJson(
        SOURCES_JSON_NAME,
        sourcePayload.sources.map((source) => serializeSourceForBackup(source, this.includeSecrets))
      );
    }

    const categoryRows = await this.categories.findByFilters({ userId: user.id });
    if (categoryRows.length > 0) {
      await workspace.writeJson(
        CATEGORIES_JSON_NAME,
        categoryRows.map((row) => ({
          id: row.id,
          parent_id: row.parentId,
          name: row.name,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        }))
      );
    }

    const tagRows = await this.tags.findByFilters({ userId: user.id });
    if (tagRows.length > 0) {
      await workspace.writeJson(
        TAGS_JSON_NAME,
        tagRows.map((row) => ({
          id: row.id,
          name: row.name,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        }))
      );
    }

    const ruleGroupRows = await this.ruleGroups.findByFilters({ userId: user.id });
    if (ruleGroupRows.length > 0) {
      await workspace.writeJson(
        RULE_GROUPS_JSON_NAME,
        ruleGroupRows.map((row) => ({
          id: row.id,
          sort_order: row.sortOrder,
          active: row.active,
          title: row.title,
          description: row.description,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        }))
      );
    }

    const ruleRows = await this.rules.findByFilters({ userId: user.id });
    if (ruleRows.length > 0) {
      await workspace.writeJson(
        RULES_JSON_NAME,
        ruleRows.map((row) => ({
          id: row.id,
          group_id: row.groupId,
          sort_order: row.sortOrder,
          active: row.active,
          stop_processing: row.stopProcessing,
          run_on_create: row.runOnCreate,
          title: row.title,
          description: row.description,
          when: row.when,
          actions: row.actions,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        }))
      );
    }
  }

  private async streamExportImportsAndTransactions(
    workspace: BackupExportFiles,
    user: User,
    shouldCancel: () => boolean
  ): Promise<void> {
    const imports = await this.transactions.listImports(user.id);
    for (const batch of chunk(imports, BACKUP_JSONL_CHUNK)) {
      if (shouldCancel()) {
        throw new JobExecutionError("Backup export was cancelled.");
      }
      for (const row of batch) {
        await workspace.appendJsonl(IMPORTS_JSONL_NAME, {
          id: row.id,
          account_id: row.accountId,
          created_at: row.createdAt,
        });
      }
    }

    await workspace.writeText(TRANSACTIONS_JSONL_NAME, "");

    let after: TransactionCursor | null = null;
    for (;;) {
      if (shouldCancel()) {
        throw new JobExecutionError("Backup export was cancelled.");
      }
      const page = await this.transactions.listByUserCursor(user.id, after, BACKUP_JSONL_CHUNK);
      for (const txn of page) {
        await workspace.appendJsonl(TRANSACTIONS_JSONL_NAME, {
          id: txn.id,
          date: txn.date,
          amount: txn.amount,
          source_account_id: txn.sourceAccountId,
          destination_account_id: txn.destinationAccountId,
          description: txn.description,
          ref_no: txn.refNo,
          import_id: txn.importId,
          category_id: txn.categoryId,
          subcategory_id: txn.subcategoryId,
          tag_ids: txn.tagIds,
          created_at: txn.createdAt,
          updated_at: txn.updatedAt,
        });
      }
      if (page.length < BACKUP_JSONL_CHUNK) {
        break;
      }
      const last = page[page.length - 1];
      if (!last) {
        break;
      }
      after = { date: last.date, createdAt: last.createdAt, id: last.id };
    }
  }

  private async finalizeExportArtifact(
    user: User,
    jobId: string,
    workspace: BackupExportFiles,
    zipPassword: string
  ): Promise<{ filename: string; bytes: number }> {
    const staging = await this.artifacts.saveStagingPath(user.id, jobId);
    await workspace.finalizeTo(staging, zipPassword);
    const bytes = await this.artifacts.promoteStaging(user.id, jobId);
    const filename = utcBackupFilename();
    const old = await this.exports.findByUserId(user.id);
    await this.exports.upsert(BackupExport.create({ userId: user.id, jobId, filename, bytes }));
    if (old && old.jobId !== jobId) {
      await this.artifacts.deleteArtifact(user.id, old.jobId);
    }
    return { filename, bytes };
  }

  private async readAndValidateImportArchive(
    zipPath: string,
    zipPassword: string
  ): Promise<{
    files: BackupImportFiles;
    vaultRaw: string;
    profileRaw: string;
    accountsRaw: string;
    systemRaw: string;
    transactionsRaw: string;
  }> {
    let files: BackupImportFiles;
    try {
      files = await this.artifacts.openZipFromPath(zipPath, zipPassword);
    } catch {
      throw new JobExecutionError("Backup password is invalid.");
    }
    const [manifestRaw, vaultRaw, profileRaw, accountsRaw, systemRaw, transactionsRaw] =
      await Promise.all([
        files.readText(MANIFEST_JSON_NAME),
        files.readText(VAULT_JSON_NAME),
        files.readText(PROFILE_JSON_NAME),
        files.readText(ACCOUNTS_JSON_NAME),
        files.readText(SYSTEM_ACCOUNTS_JSON_NAME),
        files.readText(TRANSACTIONS_JSONL_NAME),
      ]);

    const missingRequired: string[] = [];
    if (!manifestRaw) {
      missingRequired.push(MANIFEST_JSON_NAME);
    }
    if (vaultRaw === undefined) {
      missingRequired.push(VAULT_JSON_NAME);
    }
    if (profileRaw === undefined) {
      missingRequired.push(PROFILE_JSON_NAME);
    }
    if (!accountsRaw) {
      missingRequired.push(ACCOUNTS_JSON_NAME);
    }
    if (!systemRaw) {
      missingRequired.push(SYSTEM_ACCOUNTS_JSON_NAME);
    }
    if (transactionsRaw === undefined) {
      missingRequired.push(TRANSACTIONS_JSONL_NAME);
    }
    if (
      missingRequired.length > 0 ||
      !manifestRaw ||
      vaultRaw === undefined ||
      profileRaw === undefined ||
      !accountsRaw ||
      !systemRaw ||
      transactionsRaw === undefined
    ) {
      throw new JobExecutionError(
        `Backup archive is missing required files: ${missingRequired.join(", ")}.`
      );
    }

    const manifest = JSON.parse(manifestRaw) as { format?: string };
    if (manifest.format !== BACKUP_FORMAT) {
      throw new JobExecutionError("Backup archive format is invalid.");
    }

    return {
      files,
      vaultRaw,
      profileRaw,
      accountsRaw,
      systemRaw,
      transactionsRaw,
    };
  }

  private async importVaultFromBackup(
    user: User,
    vaultRaw: string
  ): Promise<{
    warnings: StatementWarning[];
    vaultSlotsImported: number;
    vaultSlotsSkipped: number;
  }> {
    const warnings: StatementWarning[] = [];
    let vaultSlotsImported = 0;
    let vaultSlotsSkipped = 0;
    const vaultFile = parseVaultFile(vaultRaw);
    if (vaultFile.slots.length === 0) {
      warnings.push(
        backupWarning("backup.import.vault.empty", "backup.import.vault.empty", VAULT_JSON_NAME)
      );
      return { warnings, vaultSlotsImported, vaultSlotsSkipped };
    }

    try {
      const restored = await this.vault.replaceFromBackup(
        user.id,
        vaultFile.slots.map((slot) => ({
          slotType: slot.slot_type,
          salt: slot.salt,
          wrapBlob: slot.wrap_blob,
          label: slot.label,
          credentialId: slot.credential_id,
        }))
      );
      vaultSlotsImported = restored.imported;
      vaultSlotsSkipped = restored.skippedPrf;
      if (restored.skippedPrf > 0) {
        warnings.push(
          backupWarning(
            "backup.vault.prf-skipped",
            `Skipped ${restored.skippedPrf} passkey vault slots`,
            VAULT_JSON_NAME
          )
        );
      }
    } catch (error) {
      if (
        error instanceof ValidationError &&
        error.message === "Backup has no usable vault slots."
      ) {
        throw new JobExecutionError("Backup has no usable vault slots.");
      }
      throw error;
    }

    return { warnings, vaultSlotsImported, vaultSlotsSkipped };
  }

  private async runImportPipeline(
    user: User,
    authAcr: string,
    archive: {
      files: BackupImportFiles;
      profileRaw: string;
      accountsRaw: string;
      systemRaw: string;
    },
    vaultOutcome: {
      warnings: StatementWarning[];
      vaultSlotsImported: number;
      vaultSlotsSkipped: number;
    },
    shouldCancel: () => boolean
  ): Promise<{ warnings: StatementWarning[]; backup: Record<string, number> }> {
    const profile = parseBackupProfile(archive.profileRaw);
    await this.users.restoreBackupProfile(user.id, profile.display_name, profile.client_settings);

    const warnings = [...vaultOutcome.warnings];
    const stats = {
      accountsCreated: 0,
      accountsUpdated: 0,
      transactionsInserted: 0,
      transactionsSkipped: 0,
      vaultSlotsImported: vaultOutcome.vaultSlotsImported,
      vaultSlotsSkipped: vaultOutcome.vaultSlotsSkipped,
    };

    const accountIdMap = new Map<string, string>();
    await this.accountService.ensureSystemAccounts(user.id);
    const destSystem = await this.accountService.listSystemAccounts(user, authAcr);
    for (const row of parseSystemAccounts(archive.systemRaw)) {
      const dest = destSystem.find((item) => item.accountType === row.account_type);
      if (!dest) {
        throw new JobExecutionError("Backup is missing a system account.");
      }
      accountIdMap.set(row.id, dest.id);
    }

    const [categoriesRaw, tagsRaw] = await Promise.all([
      archive.files.readText(CATEGORIES_JSON_NAME),
      archive.files.readText(TAGS_JSON_NAME),
    ]);
    const categoryIdMap = await this.importCategories(user.id, categoriesRaw);
    const tagIdMap = await this.importTags(user.id, tagsRaw);

    const instrumentStats = await this.importInstrumentAccounts(
      user,
      authAcr,
      archive.accountsRaw,
      accountIdMap
    );
    stats.accountsCreated += instrumentStats.created;
    stats.accountsUpdated += instrumentStats.updated;

    const sourcesWrite = parseSourcesWrite(await archive.files.readText(SOURCES_JSON_NAME));
    if (sourcesWrite.length > 0) {
      await this.sources.updateSources(user, authAcr, { sources: sourcesWrite });
    }

    const importIdMap = await this.importTransactionImports(
      user.id,
      archive.files,
      accountIdMap,
      shouldCancel
    );

    const groupIdMap = await this.importRuleGroups(
      user.id,
      await archive.files.readText(RULE_GROUPS_JSON_NAME)
    );
    await this.importRules(
      user.id,
      await archive.files.readText(RULES_JSON_NAME),
      groupIdMap,
      accountIdMap,
      categoryIdMap,
      tagIdMap,
      importIdMap
    );

    const importStats = await this.importTransactions(
      user.id,
      archive.files,
      accountIdMap,
      categoryIdMap,
      tagIdMap,
      importIdMap,
      shouldCancel
    );
    stats.transactionsInserted += importStats.inserted;
    stats.transactionsSkipped += importStats.skipped;

    return { warnings, backup: stats };
  }

  private async loadCurrentExport(userId: string): Promise<BackupExport | null> {
    const current = await this.exports.findByUserId(userId);
    if (!current) {
      return null;
    }
    if (current.isExpired()) {
      await this.artifacts.deleteArtifact(userId, current.jobId);
      await this.exports.deleteByUserId(userId);
      return null;
    }
    return current;
  }

  private async findActiveExportJobId(userId: string): Promise<string | null> {
    const conflict = await this.jobs.findConflict(userId, "backup_export", JobScope.empty());
    return conflict?.id ?? null;
  }

  private async findActiveImportJobId(userId: string): Promise<string | null> {
    const conflict = await this.jobs.findConflict(userId, "backup_import", JobScope.empty());
    return conflict?.id ?? null;
  }

  private async assertNoActiveBackupJob(userId: string): Promise<void> {
    const scope = JobScope.empty();
    const [exportConflict, importConflict] = await Promise.all([
      this.jobs.findConflict(userId, "backup_export", scope),
      this.jobs.findConflict(userId, "backup_import", scope),
    ]);
    const conflict = exportConflict ?? importConflict;
    if (conflict) {
      throw new ConflictError("A job is already running.", {
        id: conflict.id,
        status: conflict.status,
      });
    }
  }

  private async importCategories(
    userId: string,
    raw: string | undefined
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const backupRows = sortCategoriesForImport(parseCategoryRows(raw));
    if (backupRows.length === 0) {
      return map;
    }

    const destRows = await this.categories.findByFilters({ userId });
    for (const backupRow of backupRows) {
      if (backupRow.parent_id && !map.has(backupRow.parent_id)) {
        continue;
      }
      const destParentId = backupRow.parent_id ? (map.get(backupRow.parent_id) ?? null) : null;
      const nameKey = backupRow.name.toLowerCase();
      const existing = destRows.find(
        (row) => row.name.toLowerCase() === nameKey && row.parentId === destParentId
      );
      if (existing) {
        map.set(backupRow.id, existing.id);
        continue;
      }
      const created = await this.categories.create(
        Category.create({
          userId,
          parentId: destParentId,
          name: backupRow.name,
          createdAt: backupRow.created_at,
          updatedAt: backupRow.updated_at,
        })
      );
      destRows.push(created);
      map.set(backupRow.id, created.id);
    }
    return map;
  }

  private async importTags(userId: string, raw: string | undefined): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const backupRows = parseTagRows(raw);
    if (backupRows.length === 0) {
      return map;
    }

    const destRows = await this.tags.findByFilters({ userId });
    for (const backupRow of backupRows) {
      const nameKey = backupRow.name.toLowerCase();
      const existing = destRows.find((row) => row.name.toLowerCase() === nameKey);
      if (existing) {
        map.set(backupRow.id, existing.id);
        continue;
      }
      const created = await this.tags.create(
        Tag.create({
          userId,
          name: backupRow.name,
          createdAt: backupRow.created_at,
          updatedAt: backupRow.updated_at,
        })
      );
      destRows.push(created);
      map.set(backupRow.id, created.id);
    }
    return map;
  }

  private async importRuleGroups(
    userId: string,
    raw: string | undefined
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const rows = parseRuleGroupRows(raw);
    for (const row of rows) {
      const existing = await this.ruleGroups.findById(userId, row.id);
      if (existing) {
        const updated = existing.withUpdates({
          sortOrder: row.sort_order,
          active: row.active,
          title: row.title,
          description: row.description,
          updatedAt: row.updated_at,
        });
        await this.ruleGroups.save(updated);
        map.set(row.id, existing.id);
        continue;
      }

      const created = await this.ruleGroups.create(
        TransactionRuleGroup.create({
          id: row.id,
          userId,
          sortOrder: row.sort_order,
          active: row.active,
          title: row.title,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      );
      map.set(row.id, created.id);
    }
    return map;
  }

  private async importRules(
    userId: string,
    raw: string | undefined,
    groupIdMap: Map<string, string>,
    accountIdMap: Map<string, string>,
    categoryIdMap: Map<string, string>,
    tagIdMap: Map<string, string>,
    importIdMap: Map<string, string>
  ): Promise<void> {
    const rows = parseRuleRows(raw);
    if (rows.length === 0) {
      return;
    }

    const maps: BackupRemapMaps = {
      accountIdMap,
      categoryIdMap,
      tagIdMap,
      importIdMap,
    };

    for (const row of rows) {
      let when: RuleExpression;
      let actions: RuleAction[];
      try {
        when = parseWhenJson(row.when);
        actions = parseActionsJson(row.actions);
      } catch (error) {
        if (error instanceof ValidationError) {
          continue;
        }
        throw error;
      }

      const destGroupId = groupIdMap.get(row.group_id) ?? row.group_id;
      when = remapWhen(when, maps);
      actions = remapActions(actions, maps);

      const existing = await this.rules.findById(userId, row.id);
      if (existing) {
        await this.rules.save(
          new TransactionRule(
            existing.id,
            existing.userId,
            destGroupId,
            row.sort_order,
            row.active,
            row.stop_processing,
            row.run_on_create,
            row.title,
            row.description,
            when,
            actions,
            existing.createdAt,
            row.updated_at
          )
        );
        continue;
      }

      await this.rules.create(
        TransactionRule.create({
          id: row.id,
          userId,
          groupId: destGroupId,
          sortOrder: row.sort_order,
          active: row.active,
          stopProcessing: row.stop_processing,
          runOnCreate: row.run_on_create,
          title: row.title,
          description: row.description,
          when,
          actions,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      );
    }
  }

  private async importInstrumentAccounts(
    user: User,
    authAcr: string,
    accountsRaw: string,
    accountIdMap: Map<string, string>
  ): Promise<{ created: number; updated: number }> {
    const parsed = JSON.parse(accountsRaw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new JobExecutionError("Accounts file is invalid.");
    }

    const destInstruments = await this.accounts.findByFilters({
      userId: user.id,
      accountTypes: INSTRUMENT_ACCOUNT_TYPES,
      listStatus: "all",
    });
    const usedIds = new Set<string>();
    let created = 0;
    let updated = 0;

    for (const rawEntry of parsed) {
      let entry: ParsedBackupAccount;
      try {
        entry = parseBackupAccountEntry(rawEntry);
      } catch {
        throw new JobExecutionError("Accounts file has an invalid entry.");
      }
      if (!isInstrumentAccountType(entry.match.accountType)) {
        throw new JobExecutionError("Accounts file has an invalid account type.");
      }

      const existingId = findExistingAccountId(
        {
          id: entry.backupId,
          bank: entry.match.bank,
          variant: entry.match.variant,
          accountType: entry.match.accountType,
          openingDate: entry.match.openingDate,
          accountNumber: entry.match.accountNumber,
        },
        destInstruments,
        usedIds
      );

      if (existingId) {
        await this.accountService.update(user, authAcr, existingId, entry.updateInput);
        accountIdMap.set(entry.backupId, existingId);
        updated += 1;
        continue;
      }

      const createdAccount = await this.accountService.create(user, authAcr, entry.createInput);
      destInstruments.push(createdAccount);
      accountIdMap.set(entry.backupId, createdAccount.id);
      usedIds.add(createdAccount.id);
      created += 1;
    }

    return { created, updated };
  }

  private async importTransactionImports(
    userId: string,
    files: { readJsonl(name: string): AsyncIterable<unknown> },
    accountIdMap: Map<string, string>,
    shouldCancel: () => boolean
  ): Promise<Map<string, string>> {
    const importIdMap = new Map<string, string>();
    const pending: BackupImportRow[] = [];

    for await (const raw of files.readJsonl(IMPORTS_JSONL_NAME)) {
      if (shouldCancel()) {
        throw new JobExecutionError("Backup import was cancelled.");
      }
      pending.push(parseImportRow(raw));
    }

    for (const batch of chunk(pending, BACKUP_JSONL_CHUNK)) {
      const owners = await this.transactions.findImportIds(batch.map((row) => row.id));
      const ownerById = new Map(owners.map((row) => [row.id, row.userId]));

      for (const row of batch) {
        const destAccountId = accountIdMap.get(row.account_id);
        if (!destAccountId) {
          continue;
        }

        const owner = ownerById.get(row.id);
        if (owner === userId) {
          importIdMap.set(row.id, row.id);
          continue;
        }

        const destId = owner ? crypto.randomUUID() : row.id;
        importIdMap.set(row.id, destId);

        await this.transactions.createImport(
          TransactionImport.create({
            id: destId,
            userId,
            accountId: destAccountId,
            createdAt: row.created_at,
          })
        );
      }
    }

    return importIdMap;
  }

  private async importTransactions(
    userId: string,
    files: { readJsonl(name: string): AsyncIterable<unknown> },
    accountIdMap: Map<string, string>,
    categoryIdMap: Map<string, string>,
    tagIdMap: Map<string, string>,
    importIdMap: Map<string, string>,
    shouldCancel: () => boolean
  ): Promise<{ inserted: number; skipped: number }> {
    const accountMap = await this.accountService.mapById(userId);
    const pending = await collectBackupTransactionRows(files, shouldCancel);
    const maps = { accountIdMap, categoryIdMap, tagIdMap, importIdMap };

    let inserted = 0;
    let skipped = 0;
    let earliestDate: string | null = null;
    const touchedAccounts = new Set<string>();
    const toInsert: Transaction[] = [];

    const flush = async (): Promise<void> => {
      if (toInsert.length === 0) {
        return;
      }
      await this.transactions.createMany(toInsert);
      inserted += toInsert.length;
      toInsert.length = 0;
    };

    for (const batch of chunk(pending, BACKUP_JSONL_CHUNK)) {
      const owners = await this.transactions.findTransactionIds(batch.map((row) => row.id));
      const ownerById = new Map(owners.map((row) => [row.id, row.userId]));

      for (const row of batch) {
        const mapped = mapBackupTransactionForImport(
          row,
          userId,
          ownerById.get(row.id),
          maps,
          accountMap
        );
        if (!mapped) {
          skipped += 1;
          continue;
        }

        toInsert.push(mapped.txn);
        touchedAccounts.add(mapped.sourceId);
        touchedAccounts.add(mapped.destId);
        if (earliestDate === null || Time.compareIsoDates(mapped.date, earliestDate) < 0) {
          earliestDate = mapped.date;
        }

        if (toInsert.length >= BACKUP_JSONL_CHUNK) {
          await flush();
        }
      }
    }

    await flush();

    if (touchedAccounts.size > 0 && earliestDate) {
      await this.transactionService.rebuildSummariesForAccounts(
        userId,
        [...touchedAccounts],
        earliestDate
      );
    }

    return { inserted, skipped };
  }
}
