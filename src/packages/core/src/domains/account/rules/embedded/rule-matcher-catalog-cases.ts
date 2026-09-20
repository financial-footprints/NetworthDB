import type { RuleTriggerType } from "@core/domains/account/rules/constants";
import {
  BANK_ID,
  baseSpendTransaction,
  buildFixtureContext,
  type defaultSpendContext,
  EXPENSE_ID,
  IMPORT_ID,
  LOAN_ID,
  makeAccount,
  REVENUE_ID,
  TAG_ID,
  UNKNOWN_ID,
} from "@core/domains/account/rules/embedded/rule-matcher-fixtures";
import type { RuleTrigger } from "@core/domains/account/rules/embedded/types";

type TriggerCase = {
  trigger: RuleTrigger;
  match: () => ReturnType<typeof baseSpendTransaction>;
  noMatch: () => ReturnType<typeof baseSpendTransaction>;
  context?: () => ReturnType<typeof defaultSpendContext>;
};

export const TRIGGER_CASES: Record<RuleTriggerType, TriggerCase> = {
  description_contains: {
    trigger: { type: "description_contains", value: "coffee" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ description: "Groceries" }),
  },
  description_not_contains: {
    trigger: { type: "description_not_contains", value: "xyz" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ description: "xyz shop" }),
  },
  description_is: {
    trigger: { type: "description_is", value: "Coffee Shop" },
    match: () => baseSpendTransaction({ description: "coffee shop" }),
    noMatch: () => baseSpendTransaction({ description: "Tea House" }),
  },
  description_is_not: {
    trigger: { type: "description_is_not", value: "Other" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ description: "Other" }),
  },
  description_starts: {
    trigger: { type: "description_starts", value: "coffee" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ description: "Buy Coffee" }),
  },
  description_ends: {
    trigger: { type: "description_ends", value: "shop" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ description: "Shop Coffee" }),
  },
  description_matches_regex: {
    trigger: { type: "description_matches_regex", value: "coffee.*shop" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ description: "Tea House" }),
  },
  ref_contains: {
    trigger: { type: "ref_contains", value: "ref" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: "ABC" }),
  },
  ref_not_contains: {
    trigger: { type: "ref_not_contains", value: "zzz" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: "zzz" }),
  },
  ref_is: {
    trigger: { type: "ref_is", value: "REF123" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: "REF124" }),
  },
  ref_is_not: {
    trigger: { type: "ref_is_not", value: "OTHER" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: "OTHER" }),
  },
  ref_starts: {
    trigger: { type: "ref_starts", value: "ref" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: "XREF" }),
  },
  ref_ends: {
    trigger: { type: "ref_ends", value: "123" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: "1230" }),
  },
  ref_matches_regex: {
    trigger: { type: "ref_matches_regex", value: "REF\\d+" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: "NOPE" }),
  },
  ref_is_empty: {
    trigger: { type: "ref_is_empty" },
    match: () => baseSpendTransaction({ refNo: null }),
    noMatch: () => baseSpendTransaction(),
  },
  ref_is_set: {
    trigger: { type: "ref_is_set" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ refNo: null }),
  },
  amount_exactly: {
    trigger: { type: "amount_exactly", amount: 10_000 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ amount: 9_999 }),
  },
  amount_not: {
    trigger: { type: "amount_not", amount: 1 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ amount: 1 }),
  },
  amount_less: {
    trigger: { type: "amount_less", amount: 20_000 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ amount: 20_000 }),
  },
  amount_less_or_equal: {
    trigger: { type: "amount_less_or_equal", amount: 10_000 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ amount: 10_001 }),
  },
  amount_greater: {
    trigger: { type: "amount_greater", amount: 5_000 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ amount: 5_000 }),
  },
  amount_greater_or_equal: {
    trigger: { type: "amount_greater_or_equal", amount: 10_000 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ amount: 9_999 }),
  },
  amount_between: {
    trigger: { type: "amount_between", min: 5_000, max: 15_000 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ amount: 15_001 }),
  },
  date_is: {
    trigger: { type: "date_is", date: "2024-06-15" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-06-16" }),
  },
  date_is_not: {
    trigger: { type: "date_is_not", date: "2024-01-01" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-01-01" }),
  },
  date_before: {
    trigger: { type: "date_before", date: "2024-07-01" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-07-01" }),
  },
  date_after: {
    trigger: { type: "date_after", date: "2024-06-01" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-06-01" }),
  },
  date_on_or_before: {
    trigger: { type: "date_on_or_before", date: "2024-06-15" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-06-16" }),
  },
  date_on_or_after: {
    trigger: { type: "date_on_or_after", date: "2024-06-15" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-06-14" }),
  },
  date_between: {
    trigger: { type: "date_between", from: "2024-06-01", to: "2024-06-30" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-07-01" }),
  },
  date_weekday_is: {
    trigger: { type: "date_weekday_is", weekday: 6 },
    match: () => baseSpendTransaction({ date: "2024-06-15" }),
    noMatch: () => baseSpendTransaction({ date: "2024-06-17" }),
  },
  date_month_is: {
    trigger: { type: "date_month_is", month: 6 },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ date: "2024-07-01" }),
  },
  source_account_is: {
    trigger: { type: "source_account_is", accountId: BANK_ID },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ sourceAccountId: LOAN_ID }),
  },
  source_account_is_not: {
    trigger: { type: "source_account_is_not", accountId: LOAN_ID },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ sourceAccountId: LOAN_ID }),
  },
  destination_account_is: {
    trigger: { type: "destination_account_is", accountId: UNKNOWN_ID },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ destinationAccountId: EXPENSE_ID }),
  },
  destination_account_is_not: {
    trigger: { type: "destination_account_is_not", accountId: EXPENSE_ID },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ destinationAccountId: EXPENSE_ID }),
  },
  either_account_is: {
    trigger: { type: "either_account_is", accountId: UNKNOWN_ID },
    match: () => baseSpendTransaction(),
    noMatch: () =>
      baseSpendTransaction({ sourceAccountId: LOAN_ID, destinationAccountId: EXPENSE_ID }),
  },
  either_account_is_not: {
    trigger: { type: "either_account_is_not", accountId: LOAN_ID },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ sourceAccountId: LOAN_ID }),
  },
  source_account_type_is: {
    trigger: { type: "source_account_type_is", accountType: "bank" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ sourceAccountId: LOAN_ID }),
    context: () => {
      const bank = makeAccount(BANK_ID, "bank", "Bank");
      const loan = makeAccount(LOAN_ID, "loan", "Loan");
      return buildFixtureContext(loan, makeAccount(UNKNOWN_ID, "unknown", "Unknown"), [bank]);
    },
  },
  destination_account_type_is: {
    trigger: { type: "destination_account_type_is", accountType: "unknown" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ destinationAccountId: EXPENSE_ID }),
  },
  either_account_type_is: {
    trigger: { type: "either_account_type_is", accountType: "expense" },
    match: () => baseSpendTransaction({ destinationAccountId: EXPENSE_ID }),
    noMatch: () => baseSpendTransaction(),
  },
  source_is_system: {
    trigger: { type: "source_is_system" },
    match: () =>
      baseSpendTransaction({ sourceAccountId: REVENUE_ID, destinationAccountId: BANK_ID }),
    noMatch: () => baseSpendTransaction(),
    context: () => {
      const bank = makeAccount(BANK_ID, "bank", "Bank");
      const revenue = makeAccount(REVENUE_ID, "revenue", "Revenue");
      return buildFixtureContext(revenue, bank);
    },
  },
  destination_is_system: {
    trigger: { type: "destination_is_system" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ destinationAccountId: LOAN_ID }),
  },
  source_is_instrument: {
    trigger: { type: "source_is_instrument" },
    match: () => baseSpendTransaction(),
    noMatch: () =>
      baseSpendTransaction({ sourceAccountId: REVENUE_ID, destinationAccountId: BANK_ID }),
  },
  destination_is_instrument: {
    trigger: { type: "destination_is_instrument" },
    match: () =>
      baseSpendTransaction({ sourceAccountId: REVENUE_ID, destinationAccountId: BANK_ID }),
    noMatch: () => baseSpendTransaction(),
    context: () => {
      const bank = makeAccount(BANK_ID, "bank", "Bank");
      const revenue = makeAccount(REVENUE_ID, "revenue", "Revenue");
      return buildFixtureContext(revenue, bank);
    },
  },
  pair_is_transfer: {
    trigger: { type: "pair_is_transfer" },
    match: () => baseSpendTransaction({ sourceAccountId: BANK_ID, destinationAccountId: LOAN_ID }),
    noMatch: () => baseSpendTransaction(),
    context: () => {
      const bank = makeAccount(BANK_ID, "bank", "Bank");
      const loan = makeAccount(LOAN_ID, "loan", "Loan");
      return buildFixtureContext(bank, loan);
    },
  },
  pair_is_spend: {
    trigger: { type: "pair_is_spend" },
    match: () => baseSpendTransaction(),
    noMatch: () =>
      baseSpendTransaction({ sourceAccountId: BANK_ID, destinationAccountId: LOAN_ID }),
  },
  pair_is_income: {
    trigger: { type: "pair_is_income" },
    match: () =>
      baseSpendTransaction({ sourceAccountId: REVENUE_ID, destinationAccountId: BANK_ID }),
    noMatch: () => baseSpendTransaction(),
    context: () => {
      const bank = makeAccount(BANK_ID, "bank", "Bank");
      const revenue = makeAccount(REVENUE_ID, "revenue", "Revenue");
      return buildFixtureContext(revenue, bank);
    },
  },
  category_is: {
    trigger: { type: "category_is", categoryId: "77777777-7777-4777-8777-777777777777" },
    match: () => baseSpendTransaction({ categoryId: "77777777-7777-4777-8777-777777777777" }),
    noMatch: () => baseSpendTransaction(),
  },
  category_is_not: {
    trigger: { type: "category_is_not", categoryId: "77777777-7777-4777-8777-777777777777" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ categoryId: "77777777-7777-4777-8777-777777777777" }),
  },
  has_category: {
    trigger: { type: "has_category" },
    match: () => baseSpendTransaction({ categoryId: "77777777-7777-4777-8777-777777777777" }),
    noMatch: () => baseSpendTransaction(),
  },
  has_no_category: {
    trigger: { type: "has_no_category" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ categoryId: "77777777-7777-4777-8777-777777777777" }),
  },
  subcategory_is: {
    trigger: { type: "subcategory_is", subcategoryId: "88888888-8888-4888-8888-888888888888" },
    match: () =>
      baseSpendTransaction({
        categoryId: "77777777-7777-4777-8777-777777777777",
        subcategoryId: "88888888-8888-4888-8888-888888888888",
      }),
    noMatch: () => baseSpendTransaction(),
  },
  subcategory_is_not: {
    trigger: { type: "subcategory_is_not", subcategoryId: "88888888-8888-4888-8888-888888888888" },
    match: () => baseSpendTransaction(),
    noMatch: () =>
      baseSpendTransaction({
        categoryId: "77777777-7777-4777-8777-777777777777",
        subcategoryId: "88888888-8888-4888-8888-888888888888",
      }),
  },
  tag_is: {
    trigger: { type: "tag_is", tagId: TAG_ID },
    match: () => baseSpendTransaction({ tagIds: [TAG_ID] }),
    noMatch: () => baseSpendTransaction(),
  },
  tag_is_not: {
    trigger: { type: "tag_is_not", tagId: TAG_ID },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ tagIds: [TAG_ID] }),
  },
  has_no_tags: {
    trigger: { type: "has_no_tags" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ tagIds: [TAG_ID] }),
  },
  has_any_tag: {
    trigger: { type: "has_any_tag" },
    match: () => baseSpendTransaction({ tagIds: [TAG_ID] }),
    noMatch: () => baseSpendTransaction(),
  },
  has_import: {
    trigger: { type: "has_import" },
    match: () => baseSpendTransaction({ importId: IMPORT_ID }),
    noMatch: () => baseSpendTransaction(),
  },
  has_no_import: {
    trigger: { type: "has_no_import" },
    match: () => baseSpendTransaction(),
    noMatch: () => baseSpendTransaction({ importId: IMPORT_ID }),
  },
  import_id_is: {
    trigger: { type: "import_id_is", importId: IMPORT_ID },
    match: () => baseSpendTransaction({ importId: IMPORT_ID }),
    noMatch: () => baseSpendTransaction(),
  },
};
