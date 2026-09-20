import type { RuleEvalContext } from "@core/domains/account/rules/embedded/types";
import { Transaction } from "@core/domains/account/transactions/entities/transaction";
import { assertAllowedTransactionPair } from "@core/domains/account/transactions/helpers";
import { ValidationError } from "@core/shared/errors/domain-error";

export function categoryTaxonomyWarning(
  context: RuleEvalContext,
  categoryId: string | null,
  subcategoryId: string | null
): string | null {
  if (subcategoryId !== null && categoryId === null) {
    return "Category is invalid.";
  }
  if (categoryId !== null) {
    const category = context.categoriesById.get(categoryId);
    if (!category) {
      return "Category was not found.";
    }
    if (category.parentId !== null) {
      return "Category is invalid.";
    }
  }
  if (subcategoryId !== null) {
    const subcategory = context.categoriesById.get(subcategoryId);
    if (!subcategory) {
      return "Category was not found.";
    }
    if (categoryId === null || subcategory.parentId !== categoryId) {
      return "Category is invalid.";
    }
  }
  return null;
}

export type TransactionRebuildPatch = {
  date?: string;
  amount?: number;
  sourceAccountId?: string;
  destinationAccountId?: string;
  description?: string;
  refNo?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  tagIds?: string[];
};

export function tryRebuild(
  base: Transaction,
  patch: TransactionRebuildPatch,
  context: RuleEvalContext
): { ok: true; transaction: Transaction } | { ok: false; warning: string } {
  const sourceId = patch.sourceAccountId ?? base.sourceAccountId;
  const destId = patch.destinationAccountId ?? base.destinationAccountId;
  const source = context.accountsById.get(sourceId) ?? context.source;
  const dest = context.accountsById.get(destId) ?? context.dest;
  try {
    assertAllowedTransactionPair(source, dest);
  } catch {
    return { ok: false, warning: "Account pair is invalid." };
  }
  try {
    const transaction = Transaction.create({
      id: base.id,
      userId: base.userId,
      date: patch.date ?? base.date,
      amount: patch.amount ?? base.amount,
      sourceAccountId: sourceId,
      destinationAccountId: destId,
      description: patch.description ?? base.description,
      refNo: patch.refNo !== undefined ? patch.refNo : base.refNo,
      importId: base.importId,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : base.categoryId,
      subcategoryId: patch.subcategoryId !== undefined ? patch.subcategoryId : base.subcategoryId,
      tagIds: patch.tagIds ?? base.tagIds,
      createdAt: base.createdAt,
      updatedAt: new Date().toISOString(),
    });
    context.source = source;
    context.dest = dest;
    return { ok: true, transaction };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, warning: "Validation failed." };
    }
    throw err;
  }
}
