import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
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

describe("RuleEngineService applyManual", () => {
  let user: User;
  let bank: Account;
  let unknownId: string;
  let expenseId: string;
  let service: TransactionService;
  let engine: RuleEngineService;
  let ruleGroups: RuleGroupService;
  let rules: RuleService;
  const accounts = new InMemoryAccountRepository();
  const transactions = accounts.transactions;
  const ruleGroupRepo = new InMemoryRuleGroupRepository();
  const ruleRepo = new InMemoryRuleRepository();

  beforeAll(async () => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("rule_apply_user"),
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
    engine = new RuleEngineService(
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

  async function seedTxn(description: string): Promise<void> {
    await service.create(user, AAL2, bank.id, {
      date: "2024-06-01",
      amount: 100,
      sourceAccountId: bank.id,
      destinationAccountId: unknownId,
      description,
    });
  }

  test("word filter only mutates matching rows", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Word filter" });
    const rule = await rules.create(user, AAL2, group.id, {
      title: "Tag coffee",
      runOnCreate: false,
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "set_description", value: "Tagged" }],
    });
    await seedTxn("coffee shop");
    await seedTxn("Tea House");

    const result = await engine.applyManual({
      userId: user.id,
      mode: { type: "rule", ruleId: rule.id },
      filters: { word: "coffee" },
      dryRun: false,
    });

    expect(result.matched).toBe(1);
    expect(result.mutated).toBe(1);
    const rows = await transactions.findByFilters({ userId: user.id });
    expect(rows.find((txn) => txn.description === "Tagged")).toBeDefined();
    expect(rows.some((txn) => txn.description === "Tea House")).toBe(true);
  });

  test("dryRun does not save or delete", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Dry" });
    const rule = await rules.create(user, AAL2, group.id, {
      title: "Would delete",
      runOnCreate: false,
      when: { op: "and", items: [{ type: "description_contains", value: "dryrun" }] },
      actions: [{ type: "delete_transaction" }],
    });
    await seedTxn("dryrun row");

    const result = await engine.applyManual({
      userId: user.id,
      mode: { type: "rule", ruleId: rule.id },
      filters: {},
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.deleted).toBe(1);
    const rows = await transactions.findByFilters({ userId: user.id });
    expect(rows.some((txn) => txn.description === "dryrun row")).toBe(true);
  });

  test("inactive rule still runs in rule mode", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Inactive rule" });
    const created = await rules.create(user, AAL2, group.id, {
      title: "Classify inactive",
      runOnCreate: false,
      when: {
        op: "and",
        items: [
          { type: "description_contains", value: "inactiveapply" },
          { type: "pair_is_spend" },
        ],
      },
      actions: [{ type: "set_destination_system", accountType: "expense" }],
    });
    await rules.update(user, AAL2, created.id, { active: false });
    await seedTxn("inactiveapply spend");

    await engine.applyManual({
      userId: user.id,
      mode: { type: "rule", ruleId: created.id },
      filters: {},
      dryRun: false,
    });

    const row = (await transactions.findByFilters({ userId: user.id })).find(
      (txn) => txn.description === "inactiveapply spend"
    );
    expect(row?.destinationAccountId).toBe(expenseId);
  });

  test("inactive child skipped in group mode", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Group apply" });
    const inactive = await rules.create(user, AAL2, group.id, {
      title: "Inactive child",
      sortOrder: 0,
      runOnCreate: false,
      when: { op: "and", items: [{ type: "description_contains", value: "groupchild" }] },
      actions: [{ type: "set_description", value: "Inactive hit" }],
    });
    await rules.update(user, AAL2, inactive.id, { active: false });
    await rules.create(user, AAL2, group.id, {
      title: "Active child",
      sortOrder: 1,
      runOnCreate: false,
      when: { op: "and", items: [{ type: "description_contains", value: "groupchild" }] },
      actions: [{ type: "append_description", value: " active" }],
    });
    await seedTxn("groupchild row");

    await engine.applyManual({
      userId: user.id,
      mode: { type: "group", groupId: group.id },
      filters: {},
      dryRun: false,
    });

    const row = (await transactions.findByFilters({ userId: user.id })).find((txn) =>
      txn.description.startsWith("groupchild")
    );
    expect(row?.description).toBe("groupchild row active");
  });

  test("runOnCreate false still runs on manual apply", async () => {
    const group = await ruleGroups.create(user, AAL2, { title: "Manual only" });
    const rule = await rules.create(user, AAL2, group.id, {
      title: "Manual delete",
      runOnCreate: false,
      when: { op: "and", items: [{ type: "description_contains", value: "manualonly" }] },
      actions: [{ type: "delete_transaction" }],
    });
    await seedTxn("manualonly row");

    await engine.applyManual({
      userId: user.id,
      mode: { type: "rule", ruleId: rule.id },
      filters: {},
      dryRun: false,
    });

    const rows = await transactions.findByFilters({ userId: user.id });
    expect(rows.some((txn) => txn.description === "manualonly row")).toBe(false);
  });
});
