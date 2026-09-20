import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  ACCOUNTS_JSON_NAME,
  BACKUP_EXPORT_TTL_MS,
  MANIFEST_JSON_NAME,
  PROFILE_JSON_NAME,
  SYSTEM_ACCOUNTS_JSON_NAME,
  TRANSACTIONS_JSONL_NAME,
  VAULT_JSON_NAME,
} from "@core/domains/account/backup/constants";
import { BackupExport } from "@core/domains/account/backup/entities/backup-export";
import { BackupService } from "@core/domains/account/backup/services/backup-service";
import { Account } from "@core/domains/account/entities/account";
import { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import { AccountService } from "@core/domains/account/services/account-service";
import { Category } from "@core/domains/account/taxonomy/entities/category";
import { Transaction } from "@core/domains/account/transactions/entities/transaction";
import { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { UserService } from "@core/domains/user/services/user-service";
import {
  VAULT_SLOT_TYPE_PASSWORD,
  VAULT_SLOT_TYPE_WEBAUTHN_PRF,
} from "@core/domains/user/vault/constants";
import { VaultService } from "@core/domains/user/vault/services/vault-service";
import { ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryAccountRepository } from "@core/tests/fakes/in-memory-account-repository";
import { InMemoryBackupArtifactStore } from "@core/tests/fakes/in-memory-backup-artifact-store";
import { InMemoryBackupExportRepository } from "@core/tests/fakes/in-memory-backup-export-repository";
import { InMemoryCategoryRepository } from "@core/tests/fakes/in-memory-category-repository";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemoryRuleGroupRepository } from "@core/tests/fakes/in-memory-rule-group-repository";
import { InMemoryRuleRepository } from "@core/tests/fakes/in-memory-rule-repository";
import { InMemorySourcesRepository } from "@core/tests/fakes/in-memory-sources-repository";
import { InMemoryTagRepository } from "@core/tests/fakes/in-memory-tag-repository";
import type { InMemoryTransactionRepository } from "@core/tests/fakes/in-memory-transaction-repository";
import { InMemoryUserRepository } from "@core/tests/fakes/in-memory-user-repository";
import { InMemoryVaultSlotRepository } from "@core/tests/fakes/in-memory-vault-slot-repository";
import { InMemoryWebAuthnCredentialRepository } from "@core/tests/fakes/in-memory-webauthn-credential-repository";
import { nullUserDataKeyLoader } from "@core/tests/fakes/null-user-data-key-loader";
import {
  shutdownTestStatementsEngine,
  testStatementsServices,
} from "@tests/bootstrap/helpers/statements-compute";

const AAL2 = "aal2";
const ZIP_PASSWORD = "password1";
const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const SOURCE_WRAP = "source.wrap";
const DEST_WRAP = "dest.wrap";

type Harness = {
  user: User;
  backup: BackupService;
  accountService: AccountService;
  transactionService: TransactionService;
  transactions: InMemoryTransactionRepository;
  accounts: InMemoryAccountRepository;
  artifacts: InMemoryBackupArtifactStore;
  jobs: InMemoryJobRepository;
  exports: InMemoryBackupExportRepository;
  categories: InMemoryCategoryRepository;
  ruleGroups: InMemoryRuleGroupRepository;
  rules: InMemoryRuleRepository;
  vault: VaultService;
  users: UserService;
  usersRepo: InMemoryUserRepository;
};

async function waitForJob(
  jobs: InMemoryJobRepository,
  userId: string,
  jobId: string
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const job = await jobs.findById(userId, jobId);
    if (job && (job.status === "completed" || job.status === "failed")) {
      if (job.status === "failed") {
        throw new Error(job.error ?? "job failed");
      }
      return;
    }
    await Bun.sleep(10);
  }
  throw new Error("job timeout");
}

function createHarness(username: string, artifacts?: InMemoryBackupArtifactStore): Harness {
  const user = new User(
    crypto.randomUUID(),
    Username.parse(username),
    "hash",
    "user",
    false,
    new Date()
  );
  const jobs = new InMemoryJobRepository();
  const jobRunner = new JobRunnerService(jobs, 2);
  const accounts = new InMemoryAccountRepository();
  const transactions = accounts.transactions;
  const categories = new InMemoryCategoryRepository();
  const ruleGroups = new InMemoryRuleGroupRepository();
  const rules = new InMemoryRuleRepository();
  const store = artifacts ?? new InMemoryBackupArtifactStore();
  const exports = new InMemoryBackupExportRepository();
  const usersRepo = new InMemoryUserRepository();
  const vault = new VaultService(
    usersRepo,
    new InMemoryVaultSlotRepository(),
    new InMemoryWebAuthnCredentialRepository(),
    {
      hash: async (plain) => plain,
      verify: async () => true,
    }
  );
  const users = new UserService(usersRepo, { revoke: async () => undefined });
  const accountService = new AccountService(
    accounts,
    new SourcesService(new InMemorySourcesRepository()),
    jobRunner,
    nullUserDataKeyLoader,
    testStatementsServices()
  );
  const transactionService = new TransactionService(
    transactions,
    accounts,
    categories,
    new InMemoryTagRepository(),
    accountService
  );
  const backup = new BackupService(
    jobRunner,
    jobs,
    exports,
    accountService,
    accounts,
    new SourcesService(new InMemorySourcesRepository()),
    categories,
    new InMemoryTagRepository(),
    ruleGroups,
    rules,
    transactions,
    transactionService,
    vault,
    users,
    store,
    true
  );

  return {
    user,
    backup,
    accountService,
    transactionService,
    transactions,
    accounts,
    artifacts: store,
    jobs,
    exports,
    categories,
    ruleGroups,
    rules,
    vault,
    users,
    usersRepo,
  };
}

async function seedUser(harness: Harness): Promise<void> {
  await harness.usersRepo.create(harness.user);
}

async function seedVault(harness: Harness, wrap: string): Promise<void> {
  await harness.vault.initialize(harness.user.id, "aal1", [
    {
      slotType: VAULT_SLOT_TYPE_PASSWORD,
      salt: DUMMY_SALT,
      wrapBlob: wrap,
      password: "password123",
    },
  ]);
}

async function exportPath(harness: Harness): Promise<string> {
  const { jobId } = await harness.backup.exportBackup(harness.user, AAL2, ZIP_PASSWORD);
  await waitForJob(harness.jobs, harness.user.id, jobId);
  return harness.artifacts.artifactPath(harness.user.id, jobId);
}

describe("BackupService", () => {
  let source: Harness;
  let unknownId = "";
  let bankAccount: Account;

  beforeAll(async () => {
    source = createHarness("backup_user");
    await seedUser(source);
    await seedVault(source, SOURCE_WRAP);
    await source.users.restoreBackupProfile(source.user.id, "sealed.name", {
      e2ee: { display_name: true },
    });

    bankAccount = Account.create({
      userId: source.user.id,
      accountType: "bank",
      bank: "HDFC",
      openingDate: "2020-01-01",
      accountNumber: "1111222233",
      passwords: [],
    });
    await source.accounts.create(bankAccount);
    await source.accountService.ensureSystemAccounts(source.user.id);
    const system = await source.accountService.listSystemAccounts(source.user, AAL2);
    unknownId = system.find((row) => row.accountType === "unknown")?.id ?? "";

    await source.transactionService.create(source.user, AAL2, bankAccount.id, {
      date: "2024-03-01",
      amount: 500,
      sourceAccountId: unknownId,
      destinationAccountId: bankAccount.id,
      description: "Coffee shop",
    });
  });

  afterAll(async () => {
    await shutdownTestStatementsEngine();
  });

  test("export includes vault, profile, system accounts, and transaction JSONL", async () => {
    const path = await exportPath(source);
    const files = await source.artifacts.openZipFromPath(path, ZIP_PASSWORD);
    const vaultRaw = await files.readText(VAULT_JSON_NAME);
    const profileRaw = await files.readText(PROFILE_JSON_NAME);
    expect(vaultRaw).toContain(SOURCE_WRAP);
    expect(profileRaw).toContain("sealed.name");

    const systemRaw = await files.readText(SYSTEM_ACCOUNTS_JSON_NAME);
    const system = JSON.parse(systemRaw ?? "[]") as Array<{ account_type: string }>;
    expect(system.some((row) => row.account_type === "unknown")).toBe(true);

    const txnLines: string[] = [];
    for await (const _line of files.readJsonl(TRANSACTIONS_JSONL_NAME)) {
      txnLines.push("line");
    }
    expect(txnLines.length).toBe(1);
  });

  test("export and import reject passwords shorter than 8 characters", async () => {
    await expect(source.backup.exportBackup(source.user, AAL2, "short")).rejects.toThrow(
      ValidationError
    );
    await expect(
      source.backup.importBackup(source.user, AAL2, "memory:x", "short")
    ).rejects.toThrow(ValidationError);
  });

  test("import remaps system account ids for transactions", async () => {
    const zipPath = await exportPath(source);
    const dest = createHarness("backup_dest", source.artifacts);
    await seedUser(dest);
    await seedVault(dest, DEST_WRAP);

    const { jobId } = await dest.backup.importBackup(dest.user, AAL2, zipPath, ZIP_PASSWORD);
    await waitForJob(dest.jobs, dest.user.id, jobId);

    const exportedZip = await dest.artifacts.openZipFromPath(zipPath, ZIP_PASSWORD);
    const exportedSystem = JSON.parse(
      (await exportedZip.readText(SYSTEM_ACCOUNTS_JSON_NAME)) ?? "[]"
    ) as Array<{ id: string; account_type: string }>;
    const backupUnknownId = exportedSystem.find((row) => row.account_type === "unknown")?.id;
    const destSystem = await dest.accountService.listSystemAccounts(dest.user, AAL2);
    const destUnknownId = destSystem.find((row) => row.accountType === "unknown")?.id;

    expect(backupUnknownId).toBeDefined();
    expect(destUnknownId).toBeDefined();
    expect(backupUnknownId).not.toBe(destUnknownId);
    const destUnknown = destUnknownId as string;

    const txns = await dest.transactions.findByFilters({ userId: dest.user.id });
    expect(txns.length).toBe(1);
    expect(txns[0]?.sourceAccountId).toBe(destUnknown);

    const destVault = await dest.vault.get(dest.user.id);
    expect(destVault.vaultSlots[0]?.wrapBlob).toBe(SOURCE_WRAP);
    expect(destVault.displayName).toBe("sealed.name");
  });

  test("import skips transactions already owned by this user", async () => {
    const zipPath = await exportPath(source);
    const before = await source.transactions.findByFilters({ userId: source.user.id });
    const { jobId } = await source.backup.importBackup(source.user, AAL2, zipPath, ZIP_PASSWORD);
    await waitForJob(source.jobs, source.user.id, jobId);
    const importJob = await source.jobs.findById(source.user.id, jobId);
    const after = await source.transactions.findByFilters({ userId: source.user.id });

    expect(after.length).toBe(before.length);
    expect(importJob?.output.backup?.transactionsInserted).toBe(0);
    expect(importJob?.output.backup?.transactionsSkipped).toBeGreaterThan(0);
  });

  test("import mints a new transaction id when another user owns the UUID", async () => {
    const txns = await source.transactions.findByFilters({ userId: source.user.id });
    const existingId = txns[0]?.id;
    expect(existingId).toBeDefined();

    const other = createHarness("backup_other");
    await seedUser(other);
    await other.accountService.ensureSystemAccounts(other.user.id);
    const otherSystem = await other.accountService.listSystemAccounts(other.user, AAL2);
    const otherUnknown = otherSystem.find((row) => row.accountType === "unknown")?.id ?? "";
    const otherRevenue = otherSystem.find((row) => row.accountType === "revenue")?.id ?? "";
    await other.transactions.create(
      Transaction.create({
        id: existingId,
        userId: other.user.id,
        date: "2024-01-01",
        amount: 1,
        sourceAccountId: otherUnknown,
        destinationAccountId: otherRevenue,
        description: "collision",
      })
    );

    const zipPath = await exportPath(source);
    const victim = createHarness("backup_victim", source.artifacts);
    await seedUser(victim);
    await seedVault(victim, DEST_WRAP);
    const { jobId } = await victim.backup.importBackup(victim.user, AAL2, zipPath, ZIP_PASSWORD);
    await waitForJob(victim.jobs, victim.user.id, jobId);

    const imported = await victim.transactions.findByFilters({ userId: victim.user.id });
    expect(imported.some((row) => row.id === existingId)).toBe(false);
    expect(imported.length).toBe(1);
  });

  test("instrument upsert matches by account number", async () => {
    const zipPath = await exportPath(source);
    const files = await source.artifacts.openZipFromPath(zipPath, ZIP_PASSWORD);
    const accountsRaw = await files.readText(ACCOUNTS_JSON_NAME);
    const entries = JSON.parse(accountsRaw ?? "[]") as Array<Record<string, unknown>>;
    entries[0] = { ...entries[0], bank: "Updated Bank Name" };
    const map = JSON.parse(
      new TextDecoder().decode(
        (await source.artifacts.readArtifact(source.user.id, zipPath.split(":").at(-1) ?? "")).bytes
      )
    ) as Record<string, string>;
    map[ACCOUNTS_JSON_NAME] = `${JSON.stringify(entries, null, 2)}\n`;
    const tamperedPath = "memory:tampered-accounts";
    source.artifacts.putBytes(tamperedPath, new TextEncoder().encode(JSON.stringify(map)));

    const countBefore = await source.accounts.aggregate({ userId: source.user.id });
    const { jobId } = await source.backup.importBackup(
      source.user,
      AAL2,
      tamperedPath,
      ZIP_PASSWORD
    );
    await waitForJob(source.jobs, source.user.id, jobId);
    const countAfter = await source.accounts.aggregate({ userId: source.user.id });
    const importJob = await source.jobs.findById(source.user.id, jobId);

    expect(countAfter).toBe(countBefore);
    expect(importJob?.output.backup?.accountsUpdated).toBeGreaterThan(0);
    expect(importJob?.output.backup?.accountsCreated).toBe(0);
    const updated = await source.accounts.findById(source.user.id, bankAccount.id);
    expect(updated?.bank).toBe("Updated Bank Name");
  });

  test("import restores rule groups and remaps set_category ids", async () => {
    const category = await source.categories.create(
      Category.create({ userId: source.user.id, name: "Food" })
    );
    const group = await source.ruleGroups.create(
      TransactionRuleGroup.create({ userId: source.user.id, title: "Backup rules group" })
    );
    await source.rules.create(
      TransactionRule.create({
        userId: source.user.id,
        groupId: group.id,
        title: "Food rule",
        when: { op: "and", items: [{ type: "has_no_category" }] },
        actions: [{ type: "set_category", categoryId: category.id, subcategoryId: null }],
      })
    );

    const zipPath = await exportPath(source);
    const dest = createHarness("backup_rules_dest", source.artifacts);
    await seedUser(dest);
    await seedVault(dest, DEST_WRAP);
    const { jobId } = await dest.backup.importBackup(dest.user, AAL2, zipPath, ZIP_PASSWORD);
    await waitForJob(dest.jobs, dest.user.id, jobId);

    const destCategory = (await dest.categories.findByFilters({ userId: dest.user.id })).find(
      (row) => row.name === "Food"
    );
    const importedRule = (await dest.rules.findByFilters({ userId: dest.user.id }))[0];
    const setCategory = importedRule?.actions.find((action) => action.type === "set_category");
    expect(destCategory).toBeDefined();
    expect(importedRule?.title).toBe("Food rule");
    if (!destCategory) {
      return;
    }
    if (setCategory?.type === "set_category") {
      expect(setCategory.categoryId).toBe(destCategory.id);
      expect(setCategory.categoryId).not.toBe(category.id);
    }
  });

  test("second import of same zip does not duplicate rule groups", async () => {
    const zipPath = await exportPath(source);
    const { jobId: firstImport } = await source.backup.importBackup(
      source.user,
      AAL2,
      zipPath,
      ZIP_PASSWORD
    );
    await waitForJob(source.jobs, source.user.id, firstImport);
    const countAfterFirst = await source.ruleGroups.aggregate({ userId: source.user.id });
    const { jobId: secondImport } = await source.backup.importBackup(
      source.user,
      AAL2,
      zipPath,
      ZIP_PASSWORD
    );
    await waitForJob(source.jobs, source.user.id, secondImport);
    expect(await source.ruleGroups.aggregate({ userId: source.user.id })).toBe(countAfterFirst);
  });

  test("second export deletes the previous artifact only after the new file exists", async () => {
    const first = await source.backup.exportBackup(source.user, AAL2, ZIP_PASSWORD);
    await waitForJob(source.jobs, source.user.id, first.jobId);
    const deleted: string[] = [];
    const originalDelete = source.artifacts.deleteArtifact.bind(source.artifacts);
    source.artifacts.deleteArtifact = async (userId, jobId) => {
      deleted.push(jobId);
      const current = await source.artifacts
        .readArtifact(source.user.id, first.jobId)
        .catch(() => null);
      if (jobId === first.jobId) {
        expect(current).not.toBeNull();
      }
      await originalDelete(userId, jobId);
    };

    const second = await source.backup.exportBackup(source.user, AAL2, ZIP_PASSWORD);
    await waitForJob(source.jobs, source.user.id, second.jobId);
    expect(deleted).toContain(first.jobId);
    source.artifacts.deleteArtifact = originalDelete;
  });

  test("failed export keeps the previous ready file", async () => {
    const first = await source.backup.exportBackup(source.user, AAL2, ZIP_PASSWORD);
    await waitForJob(source.jobs, source.user.id, first.jobId);
    const originalCreate = source.artifacts.createExportWorkspace.bind(source.artifacts);
    source.artifacts.createExportWorkspace = async () => {
      const workspace = await originalCreate();
      return {
        writeJson: workspace.writeJson.bind(workspace),
        writeText: workspace.writeText.bind(workspace),
        appendJsonl: workspace.appendJsonl.bind(workspace),
        finalizeTo: async () => {
          throw new Error("finalize failed");
        },
      };
    };

    const { jobId } = await source.backup.exportBackup(source.user, AAL2, ZIP_PASSWORD);
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const job = await source.jobs.findById(source.user.id, jobId);
      if (job && (job.status === "completed" || job.status === "failed")) {
        expect(job.status).toBe("failed");
        break;
      }
      await Bun.sleep(10);
    }
    source.artifacts.createExportWorkspace = originalCreate;
    const status = await source.backup.getExportStatus(source.user, AAL2);
    expect(status.current?.filename).toBeDefined();
  });

  test("getExportStatus reports active import job until restore finishes", async () => {
    const zipPath = await exportPath(source);
    const { jobId } = await source.backup.importBackup(source.user, AAL2, zipPath, ZIP_PASSWORD);
    const whileRunning = await source.backup.getExportStatus(source.user, AAL2);
    const job = await source.jobs.findById(source.user.id, jobId);
    if (job?.isActive()) {
      expect(whileRunning.activeImportJobId).toBe(jobId);
    }
    await waitForJob(source.jobs, source.user.id, jobId);
    const after = await source.backup.getExportStatus(source.user, AAL2);
    expect(after.activeImportJobId).toBeNull();
  });

  test("expired export is treated as missing", async () => {
    const { jobId } = await source.backup.exportBackup(source.user, AAL2, ZIP_PASSWORD);
    await waitForJob(source.jobs, source.user.id, jobId);
    const current = await source.exports.findByUserId(source.user.id);
    expect(current).not.toBeNull();
    if (!current) {
      throw new Error("expected export");
    }
    const expired = new BackupExport(
      current.id,
      current.userId,
      current.jobId,
      current.filename,
      current.bytes,
      new Date(Date.now() - BACKUP_EXPORT_TTL_MS - 1_000),
      new Date(Date.now() - 1_000)
    );
    await source.exports.upsert(expired);
    const status = await source.backup.getExportStatus(source.user, AAL2);
    expect(status.current).toBeNull();
  });

  test("import rejects invalid backup format", async () => {
    const zipPath = await exportPath(source);
    const files = JSON.parse(
      new TextDecoder().decode(
        (await source.artifacts.readArtifact(source.user.id, zipPath.split(":").at(-1) ?? "")).bytes
      )
    ) as Record<string, string>;
    files[MANIFEST_JSON_NAME] =
      `${JSON.stringify({ format: "ndb.backup.2", created_at: new Date().toISOString() }, null, 2)}\n`;
    const invalidFormatPath = "memory:invalid-backup-format";
    source.artifacts.putBytes(invalidFormatPath, new TextEncoder().encode(JSON.stringify(files)));
    const { jobId } = await source.backup.importBackup(
      source.user,
      AAL2,
      invalidFormatPath,
      ZIP_PASSWORD
    );
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const job = await source.jobs.findById(source.user.id, jobId);
      if (job && (job.status === "completed" || job.status === "failed")) {
        expect(job.status).toBe("failed");
        expect(job.error).toContain("Backup archive format is invalid.");
        return;
      }
      await Bun.sleep(10);
    }
    throw new Error("job timeout");
  });

  test("import of unmatched PRF-only vault fails and leaves dest vault", async () => {
    const zipPath = await exportPath(source);
    const files = JSON.parse(
      new TextDecoder().decode(
        (await source.artifacts.readArtifact(source.user.id, zipPath.split(":").at(-1) ?? "")).bytes
      )
    ) as Record<string, string>;
    files[VAULT_JSON_NAME] = `${JSON.stringify(
      {
        slots: [
          {
            slot_type: VAULT_SLOT_TYPE_WEBAUTHN_PRF,
            salt: DUMMY_SALT,
            wrap_blob: SOURCE_WRAP,
            label: "",
            credential_id: "AQID",
          },
        ],
      },
      null,
      2
    )}\n`;
    const prfPath = "memory:prf-only";
    source.artifacts.putBytes(prfPath, new TextEncoder().encode(JSON.stringify(files)));

    const dest = createHarness("backup_prf_dest", source.artifacts);
    await seedUser(dest);
    await seedVault(dest, DEST_WRAP);
    const { jobId } = await dest.backup.importBackup(dest.user, AAL2, prfPath, ZIP_PASSWORD);
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const job = await dest.jobs.findById(dest.user.id, jobId);
      if (job && (job.status === "completed" || job.status === "failed")) {
        expect(job.status).toBe("failed");
        expect(job.error).toContain("Backup has no usable vault slots.");
        const destVault = await dest.vault.get(dest.user.id);
        expect(destVault.vaultSlots[0]?.wrapBlob).toBe(DEST_WRAP);
        return;
      }
      await Bun.sleep(10);
    }
    throw new Error("job timeout");
  });
});
