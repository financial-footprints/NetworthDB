import { Account } from "@core/domains/account/entities/account";
import type { RuleEvalContext } from "@core/domains/account/rules/embedded/types";
import { Category } from "@core/domains/account/taxonomy/entities/category";
import { Tag } from "@core/domains/account/taxonomy/entities/tag";
import { Transaction } from "@core/domains/account/transactions/entities/transaction";

export const FIXTURE_USER_ID = "11111111-1111-4111-8111-111111111111";

export function makeAccount(
  id: string,
  accountType: Account["accountType"],
  bank: string
): Account {
  return Account.create({
    id,
    userId: FIXTURE_USER_ID,
    accountType,
    bank,
    openingDate: "2020-01-01",
    accountNumber: id.slice(0, 8),
    passwords: [],
  });
}

export const BANK_ID = "22222222-2222-4222-8222-222222222222";
export const LOAN_ID = "33333333-3333-4333-8333-333333333333";
export const UNKNOWN_ID = "44444444-4444-4444-8444-444444444444";
export const EXPENSE_ID = "55555555-5555-4555-8555-555555555555";
export const REVENUE_ID = "66666666-6666-4666-8666-666666666666";
export const CATEGORY_ID = "77777777-7777-4777-8777-777777777777";
export const SUBCATEGORY_ID = "88888888-8888-4888-8888-888888888888";
export const TAG_ID = "99999999-9999-4999-8999-999999999999";
export const IMPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export function baseSpendTransaction(
  overrides: {
    description?: string;
    refNo?: string | null;
    amount?: number;
    date?: string;
    categoryId?: string | null;
    subcategoryId?: string | null;
    tagIds?: string[];
    importId?: string | null;
    sourceAccountId?: string;
    destinationAccountId?: string;
  } = {}
): Transaction {
  return Transaction.create({
    userId: FIXTURE_USER_ID,
    date: overrides.date ?? "2024-06-15",
    amount: overrides.amount ?? 10_000,
    sourceAccountId: overrides.sourceAccountId ?? BANK_ID,
    destinationAccountId: overrides.destinationAccountId ?? UNKNOWN_ID,
    description: overrides.description ?? "Coffee Shop",
    refNo: overrides.refNo !== undefined ? overrides.refNo : "REF123",
    categoryId: overrides.categoryId ?? null,
    subcategoryId: overrides.subcategoryId ?? null,
    tagIds: overrides.tagIds ?? [],
    importId: overrides.importId ?? null,
  });
}

export function buildFixtureContext(
  source: Account,
  dest: Account,
  extraAccounts: Account[] = []
): RuleEvalContext {
  const accountsById = new Map<string, Account>();
  for (const account of [source, dest, ...extraAccounts]) {
    accountsById.set(account.id, account);
  }
  const category = Category.create({
    id: CATEGORY_ID,
    userId: FIXTURE_USER_ID,
    parentId: null,
    name: "Food",
  });
  const subcategory = Category.create({
    id: SUBCATEGORY_ID,
    userId: FIXTURE_USER_ID,
    parentId: CATEGORY_ID,
    name: "Dining",
  });
  const tag = Tag.create({ id: TAG_ID, userId: FIXTURE_USER_ID, name: "trip" });
  const bank = makeAccount(BANK_ID, "bank", "Bank");
  const loan = makeAccount(LOAN_ID, "loan", "Loan");
  const unknown = makeAccount(UNKNOWN_ID, "unknown", "Unknown");
  const expense = makeAccount(EXPENSE_ID, "expense", "Expense");
  const revenue = makeAccount(REVENUE_ID, "revenue", "Revenue");
  accountsById.set(bank.id, bank);
  accountsById.set(loan.id, loan);
  accountsById.set(unknown.id, unknown);
  accountsById.set(expense.id, expense);
  accountsById.set(revenue.id, revenue);
  return {
    source,
    dest,
    accountsById,
    categoriesById: new Map([
      [category.id, category],
      [subcategory.id, subcategory],
    ]),
    tagsById: new Map([[tag.id, tag]]),
    systemByType: {
      unknown,
      expense,
      revenue,
      tumbler: makeAccount("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "tumbler", "Tumbler"),
    },
  };
}

export function defaultSpendContext(): RuleEvalContext {
  const bank = makeAccount(BANK_ID, "bank", "Bank");
  const unknown = makeAccount(UNKNOWN_ID, "unknown", "Unknown");
  return buildFixtureContext(bank, unknown);
}
