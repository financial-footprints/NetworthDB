import { describe, expect, test } from "bun:test";
import { RULE_TRIGGER_TYPES } from "@core/domains/account/rules/constants";
import {
  applyActions,
  matchWhen,
  walkRules,
} from "@core/domains/account/rules/embedded/match-apply";
import { TRIGGER_CASES } from "@core/domains/account/rules/embedded/rule-matcher-catalog-cases";
import {
  BANK_ID,
  baseSpendTransaction,
  buildFixtureContext,
  CATEGORY_ID,
  defaultSpendContext,
  EXPENSE_ID,
  FIXTURE_USER_ID,
  makeAccount,
  REVENUE_ID,
  SUBCATEGORY_ID,
  TAG_ID,
  UNKNOWN_ID,
} from "@core/domains/account/rules/embedded/rule-matcher-fixtures";
import { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";

describe("matchWhen catalog", () => {
  test("TRIGGER_CASES covers every catalog trigger type", () => {
    for (const type of RULE_TRIGGER_TYPES) {
      expect(TRIGGER_CASES[type]).toBeDefined();
    }
  });

  for (const type of RULE_TRIGGER_TYPES) {
    test(type, () => {
      const caseRow = TRIGGER_CASES[type];
      expect(caseRow).toBeDefined();
      const ctx = (caseRow.context ?? defaultSpendContext)();
      expect(matchWhen(caseRow.match(), { op: "and", items: [caseRow.trigger] }, ctx)).toBe(true);
      expect(matchWhen(caseRow.noMatch(), { op: "and", items: [caseRow.trigger] }, ctx)).toBe(
        false
      );
    });
  }

  test("empty and never matches", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    expect(matchWhen(txn, { op: "and", items: [] }, ctx)).toBe(false);
  });

  test("and or and nested groups", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    expect(
      matchWhen(
        txn,
        {
          op: "and",
          items: [
            { type: "description_contains", value: "coffee" },
            { type: "amount_exactly", amount: 10_000 },
          ],
        },
        ctx
      )
    ).toBe(true);
    expect(
      matchWhen(
        txn,
        {
          op: "and",
          items: [
            { type: "amount_exactly", amount: 1 },
            { type: "description_contains", value: "coffee" },
          ],
        },
        ctx
      )
    ).toBe(false);
    expect(
      matchWhen(
        txn,
        {
          op: "or",
          items: [
            { type: "amount_exactly", amount: 1 },
            { type: "description_contains", value: "coffee" },
          ],
        },
        ctx
      )
    ).toBe(true);
    expect(
      matchWhen(
        txn,
        {
          op: "or",
          items: [
            {
              op: "and",
              items: [
                { type: "amount_exactly", amount: 1 },
                { type: "description_contains", value: "coffee" },
              ],
            },
            { type: "description_contains", value: "coffee" },
          ],
        },
        ctx
      )
    ).toBe(true);
  });

  test("description_contains is case-insensitive", () => {
    const txn = baseSpendTransaction({ description: "COFFEE shop" });
    const ctx = defaultSpendContext();
    expect(matchWhen(txn, { type: "description_contains", value: "coffee" }, ctx)).toBe(true);
  });
});

describe("applyActions catalog", () => {
  test("empty actions no-op", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(txn, [], ctx);
    expect(result.transaction).toBe(txn);
    expect(result.deleted).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  test("set_category success", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(
      txn,
      [{ type: "set_category", categoryId: CATEGORY_ID, subcategoryId: SUBCATEGORY_ID }],
      ctx
    );
    expect(result.deleted).toBe(false);
    expect(result.transaction.subcategoryId).toBe(SUBCATEGORY_ID);
  });

  test("set_category warns on missing category", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(
      txn,
      [{ type: "set_category", categoryId: crypto.randomUUID(), subcategoryId: null }],
      ctx
    );
    expect(result.warnings).toContain("Category was not found.");
  });

  test("clear_category", () => {
    const txn = baseSpendTransaction({ categoryId: CATEGORY_ID });
    const ctx = defaultSpendContext();
    const result = applyActions(txn, [{ type: "clear_category" }], ctx);
    expect(result.transaction.categoryId).toBeNull();
  });

  test("add_tag and remove_tag", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const added = applyActions(txn, [{ type: "add_tag", tagId: TAG_ID }], ctx);
    expect(added.transaction.tagIds).toContain(TAG_ID);
    const removed = applyActions(added.transaction, [{ type: "remove_tag", tagId: TAG_ID }], ctx);
    expect(removed.transaction.tagIds).not.toContain(TAG_ID);
  });

  test("add_tag warns when missing", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(txn, [{ type: "add_tag", tagId: crypto.randomUUID() }], ctx);
    expect(result.warnings).toContain("Tag was not found.");
  });

  test("clear_tags and set_tags", () => {
    const txn = baseSpendTransaction({ tagIds: [TAG_ID] });
    const ctx = defaultSpendContext();
    const cleared = applyActions(txn, [{ type: "clear_tags" }], ctx);
    expect(cleared.transaction.tagIds).toHaveLength(0);
    const set = applyActions(cleared.transaction, [{ type: "set_tags", tagIds: [TAG_ID] }], ctx);
    expect(set.transaction.tagIds).toEqual([TAG_ID]);
  });

  test("description actions", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const set = applyActions(txn, [{ type: "set_description", value: "New" }], ctx);
    expect(set.transaction.description).toBe("New");
    const append = applyActions(
      set.transaction,
      [{ type: "append_description", value: "note" }],
      ctx
    );
    expect(append.transaction.description).toBe("New note");
    const prepend = applyActions(
      append.transaction,
      [{ type: "prepend_description", value: "pre" }],
      ctx
    );
    expect(prepend.transaction.description).toBe("pre New note");
    const replaced = applyActions(
      prepend.transaction,
      [{ type: "replace_in_description", find: "new", replace: "OLD" }],
      ctx
    );
    expect(replaced.transaction.description.toLowerCase()).toContain("old");
  });

  test("set_description empty warns", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(txn, [{ type: "set_description", value: "   " }], ctx);
    expect(result.warnings).toContain("Replacement text is invalid.");
  });

  test("ref actions", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const set = applyActions(txn, [{ type: "set_ref_no", value: "X1" }], ctx);
    expect(set.transaction.refNo).toBe("X1");
    const cleared = applyActions(set.transaction, [{ type: "clear_ref_no" }], ctx);
    expect(cleared.transaction.refNo).toBeNull();
  });

  test("set_destination_account to expense", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(
      txn,
      [{ type: "set_destination_account", accountId: EXPENSE_ID }],
      ctx
    );
    expect(result.transaction.destinationAccountId).toBe(EXPENSE_ID);
  });

  test("set_destination_account missing warns", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(
      txn,
      [{ type: "set_destination_account", accountId: crypto.randomUUID() }],
      ctx
    );
    expect(result.warnings).toContain("Account was not found.");
  });

  test("set_destination_system", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(
      txn,
      [{ type: "set_destination_system", accountType: "expense" }],
      ctx
    );
    expect(result.transaction.destinationAccountId).toBe(EXPENSE_ID);
  });

  test("set_destination_system missing warns", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    ctx.systemByType = {};
    const result = applyActions(
      txn,
      [{ type: "set_destination_system", accountType: "expense" }],
      ctx
    );
    expect(result.warnings).toContain("System account was not found.");
  });

  test("invalid pair warns", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(
      txn,
      [{ type: "set_destination_account", accountId: BANK_ID }],
      ctx
    );
    expect(result.warnings).toContain("Account pair is invalid.");
  });

  test("delete_transaction", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(txn, [{ type: "delete_transaction" }], ctx);
    expect(result.deleted).toBe(true);
  });

  test("set_source_account success on income pair", () => {
    const bank = makeAccount(BANK_ID, "bank", "Bank");
    const revenue = makeAccount(REVENUE_ID, "revenue", "Revenue");
    const ctx = buildFixtureContext(revenue, bank);
    const txn = baseSpendTransaction({
      sourceAccountId: REVENUE_ID,
      destinationAccountId: BANK_ID,
    });
    const result = applyActions(txn, [{ type: "set_source_account", accountId: UNKNOWN_ID }], ctx);
    expect(result.transaction.sourceAccountId).toBe(UNKNOWN_ID);
  });

  test("set_source_account invalid pair warns", () => {
    const bank = makeAccount(BANK_ID, "bank", "Bank");
    const revenue = makeAccount(REVENUE_ID, "revenue", "Revenue");
    const ctx = buildFixtureContext(revenue, bank);
    const txn = baseSpendTransaction({
      sourceAccountId: REVENUE_ID,
      destinationAccountId: BANK_ID,
    });
    const result = applyActions(txn, [{ type: "set_source_account", accountId: BANK_ID }], ctx);
    expect(result.warnings).toContain("Account pair is invalid.");
  });

  test("set_source_system on income pair", () => {
    const bank = makeAccount(BANK_ID, "bank", "Bank");
    const revenue = makeAccount(REVENUE_ID, "revenue", "Revenue");
    const ctx = buildFixtureContext(revenue, bank);
    const txn = baseSpendTransaction({
      sourceAccountId: REVENUE_ID,
      destinationAccountId: BANK_ID,
    });
    const result = applyActions(txn, [{ type: "set_source_system", accountType: "unknown" }], ctx);
    expect(result.transaction.sourceAccountId).toBe(UNKNOWN_ID);
  });

  test("remove_tag no-op when tag absent", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const result = applyActions(txn, [{ type: "remove_tag", tagId: TAG_ID }], ctx);
    expect(result.warnings).toHaveLength(0);
    expect(result.transaction.tagIds).toHaveLength(0);
  });
});

describe("walkRules", () => {
  test("stop_processing skips later rules", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const group = TransactionRuleGroup.create({
      userId: FIXTURE_USER_ID,
      title: "G",
      sortOrder: 0,
    });
    const first = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: group.id,
      title: "First",
      sortOrder: 0,
      when: { op: "and", items: [{ type: "description_contains", value: "coffee" }] },
      actions: [{ type: "set_description", value: "Hit" }],
      stopProcessing: true,
    });
    const second = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: group.id,
      title: "Second",
      sortOrder: 1,
      when: { op: "and", items: [{ type: "description_contains", value: "coffee" }] },
      actions: [{ type: "append_description", value: "miss" }],
    });
    const result = walkRules(txn, [group], new Map([[group.id, [first, second]]]), ctx);
    expect(result.transaction.description).toBe("Hit");
    expect(result.stopped).toBe(true);
  });

  test("delete stops later rules", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const group = TransactionRuleGroup.create({ userId: FIXTURE_USER_ID, title: "G" });
    const killer = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: group.id,
      title: "Delete",
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "delete_transaction" }],
    });
    const after = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: group.id,
      title: "After",
      sortOrder: 1,
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "set_description", value: "Nope" }],
    });
    const result = walkRules(txn, [group], new Map([[group.id, [killer, after]]]), ctx);
    expect(result.deleted).toBe(true);
    expect(result.stopped).toBe(true);
  });

  test("inactive group and rule are skipped", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const inactiveGroup = TransactionRuleGroup.create({
      userId: FIXTURE_USER_ID,
      title: "Off",
      active: false,
    });
    const activeGroup = TransactionRuleGroup.create({
      userId: FIXTURE_USER_ID,
      title: "On",
      sortOrder: 1,
    });
    const inactiveRule = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: activeGroup.id,
      title: "Off rule",
      active: false,
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "set_description", value: "Bad" }],
    });
    const activeRule = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: activeGroup.id,
      title: "On rule",
      sortOrder: 1,
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "set_description", value: "Good" }],
    });
    const result = walkRules(
      txn,
      [inactiveGroup, activeGroup],
      new Map([
        [inactiveGroup.id, []],
        [activeGroup.id, [inactiveRule, activeRule]],
      ]),
      ctx
    );
    expect(result.transaction.description).toBe("Good");
  });

  test("walk order respects sortOrder", () => {
    const txn = baseSpendTransaction();
    const ctx = defaultSpendContext();
    const group = TransactionRuleGroup.create({ userId: FIXTURE_USER_ID, title: "G" });
    const late = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: group.id,
      title: "Late",
      sortOrder: 10,
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "append_description", value: "Late" }],
    });
    const early = TransactionRule.create({
      userId: FIXTURE_USER_ID,
      groupId: group.id,
      title: "Early",
      sortOrder: 0,
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "append_description", value: "Early" }],
    });
    const result = walkRules(txn, [group], new Map([[group.id, [late, early]]]), ctx);
    expect(result.transaction.description).toBe("Coffee Shop Early Late");
  });
});
