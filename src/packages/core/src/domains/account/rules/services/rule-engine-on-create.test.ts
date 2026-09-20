import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import { RuleEngineService } from "@core/domains/account/rules/services/rule-engine-service";
import { RuleGroupService } from "@core/domains/account/rules/services/rule-group-service";
import { RuleService } from "@core/domains/account/rules/services/rule-service";
import { AccountService } from "@core/domains/account/services/account-service";
import { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { InMemoryAccountRepository } from "@core/tests/fakes/in-memory-account-repository";
import { InMemoryCategoryRepository } from "@core/tests/fakes/in-memory-category-repository";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemoryRuleGroupRepository } from "@core/tests/fakes/in-memory-rule-group-repository";
import { InMemoryRuleRepository } from "@core/tests/fakes/in-memory-rule-repository";
import { InMemorySourcesRepository } from "@core/tests/fakes/in-memory-sources-repository";
import { InMemoryTagRepository } from "@core/tests/fakes/in-memory-tag-repository";
import { nullUserDataKeyLoader } from "@core/tests/fakes/null-user-data-key-loader";
import {
  shutdownTestStatementsEngine,
  testStatementsServices,
} from "@tests/bootstrap/helpers/statements-compute";

const AAL2 = "aal2";

const SAMPLE_CSV = `date,description,ref,credited,debited
2024-01-15,Coffee shop,,0.00,10.00`;

describe("RuleEngineService on create", () => {
  let user: User;
  let bank: Account;
  let unknownId: string;
  let expenseId: string;
  let service: TransactionService;
  let ruleGroups: RuleGroupService;
  let rules: RuleService;
  const accounts = new InMemoryAccountRepository();
  const transactions = accounts.transactions;
  const ruleGroupRepo = new InMemoryRuleGroupRepository();
  const ruleRepo = new InMemoryRuleRepository();

  beforeAll(async () => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("rule_engine_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    bank = Account.create({
      userId: user.id,
      accountType: "bank",
      bank: "HDFC",
      openingDate: "2020-01-01",
      accountNumber: "1234567890",
      passwords: [],
    });
    await accounts.create(bank);
    const accountService = new AccountService(
      accounts,
      new SourcesService(new InMemorySourcesRepository()),
      new JobRunnerService(new InMemoryJobRepository(), 1),
      nullUserDataKeyLoader,
      testStatementsServices()
    );
    await accountService.ensureSystemAccounts(user.id);
    const system = await accountService.listSystemAccounts(user, AAL2);
    unknownId = system.find((item) => item.accountType === "unknown")?.id ?? "";
    expenseId = system.find((item) => item.accountType === "expense")?.id ?? "";
    ruleGroups = new RuleGroupService(ruleGroupRepo, ruleRepo);
    rules = new RuleService(ruleRepo, ruleGroupRepo);
    service = new TransactionService(
      transactions,
      accounts,
      new InMemoryCategoryRepository(),
      new InMemoryTagRepository(),
      accountService
    );
    const engine = new RuleEngineService(
      ruleGroupRepo,
      ruleRepo,
      transactions,
      accounts,
      new InMemoryCategoryRepository(),
      new InMemoryTagRepository()
    );
    service.attachRuleEngine(engine);
  });

  afterAll(async () => {
    await shutdownTestStatementsEngine();
  });

  async function seedSpendToExpenseRule(): Promise<void> {
    const group = await ruleGroups.create(user, AAL2, { title: "Spend classify" });
    await rules.create(user, AAL2, group.id, {
      title: "Coffee to expense",
      when: {
        op: "and",
        items: [{ type: "description_contains", value: "coffee" }, { type: "pair_is_spend" }],
      },
      actions: [{ type: "set_destination_system", accountType: "expense" }],
    });
  }

  test("create reclassifies spend to expense", async () => {
    await seedSpendToExpenseRule();
    const row = await service.create(user, AAL2, bank.id, {
      date: "2024-06-01",
      amount: 5000,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description: "Coffee shop",
    });
    expect(row).not.toBeNull();
    expect(row?.destinationAccountId).toBe(expenseId);
  });

  test("create delete rule removes row", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Delete noise" });
    await rules.create(user, AAL2, group.id, {
      title: "Drop coffee",
      when: { op: "and", items: [{ type: "description_contains", value: "dropme" }] },
      actions: [{ type: "delete_transaction" }],
    });
    const row = await service.create(user, AAL2, bank.id, {
      date: "2024-06-02",
      amount: 100,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description: "dropme txn",
    });
    expect(row).toBeNull();
    const listed = await transactions.findByFilters({ userId: user.id });
    expect(listed.some((txn) => txn.description === "dropme txn")).toBe(false);
  });

  test("runOnCreate false leaves row unchanged", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Off create" });
    await rules.create(user, AAL2, group.id, {
      title: "Would delete",
      runOnCreate: false,
      when: { op: "and", items: [{ type: "description_contains", value: "skiprules" }] },
      actions: [{ type: "delete_transaction" }],
    });
    const row = await service.create(user, AAL2, bank.id, {
      date: "2024-06-03",
      amount: 100,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description: "skiprules here",
    });
    expect(row).not.toBeNull();
    expect(row?.destinationAccountId).toBe(unknownId);
  });

  test("inactive group is skipped", async () => {
    const inactive = TransactionRuleGroup.create({
      userId: user.id,
      title: "Inactive",
      active: false,
    });
    await ruleGroupRepo.create(inactive);
    const rule = TransactionRule.create({
      userId: user.id,
      groupId: inactive.id,
      title: "Would classify",
      when: { op: "and", items: [{ type: "description_contains", value: "inactivetest" }] },
      actions: [{ type: "set_destination_system", accountType: "expense" }],
    });
    await ruleRepo.create(rule);
    const row = await service.create(user, AAL2, bank.id, {
      date: "2024-06-04",
      amount: 100,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description: "inactivetest",
    });
    expect(row?.destinationAccountId).toBe(unknownId);
  });

  test("ingestVaultCsv applies on-create rules", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Ingest" });
    await rules.create(user, AAL2, group.id, {
      title: "Ingest coffee",
      when: {
        op: "and",
        items: [{ type: "description_contains", value: "coffee" }, { type: "pair_is_spend" }],
      },
      actions: [{ type: "set_destination_system", accountType: "expense" }],
    });
    await service.ingestVaultCsv(user.id, bank.id, unknownId, SAMPLE_CSV, null);
    const rows = await transactions.findByFilters({ userId: user.id });
    const ingested = rows.find((txn) => txn.description === "Coffee shop");
    expect(ingested?.destinationAccountId).toBe(expenseId);
  });

  test("update does not run on-create rules", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "No update" });
    await rules.create(user, AAL2, group.id, {
      title: "Delete on create only",
      when: { op: "and", items: [{ type: "description_contains", value: "patchme" }] },
      actions: [{ type: "delete_transaction" }],
    });
    const created = await service.create(user, AAL2, bank.id, {
      date: "2024-06-05",
      amount: 100,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description: "safe",
    });
    expect(created).not.toBeNull();
    if (!created) {
      throw new Error("expected transaction");
    }
    const updated = await service.update(user, AAL2, bank.id, created.id, {
      date: "2024-06-05",
      amount: 100,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description: "patchme",
      refNo: null,
      categoryId: null,
      subcategoryId: null,
      tagIds: [],
    });
    expect(updated.description).toBe("patchme");
  });

  test("unattached engine does not mutate", async () => {
    const plain = new TransactionService(
      transactions,
      accounts,
      new InMemoryCategoryRepository(),
      new InMemoryTagRepository(),
      new AccountService(
        accounts,
        new SourcesService(new InMemorySourcesRepository()),
        new JobRunnerService(new InMemoryJobRepository(), 1),
        nullUserDataKeyLoader,
        testStatementsServices()
      )
    );
    const row = await plain.create(user, AAL2, bank.id, {
      date: "2024-06-06",
      amount: 100,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description: "plain row",
    });
    expect(row?.destinationAccountId).toBe(unknownId);
  });
});
