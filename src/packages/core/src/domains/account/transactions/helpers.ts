import { isInstrumentAccountType } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import type { TransactionRepository } from "@core/domains/account/transactions/repositories/transaction-repository";
import { ValidationError } from "@core/shared/errors/domain-error";

export function isSpendCounterpart(type: string): boolean {
  return type === "unknown" || type === "expense" || type === "tumbler";
}

export function isIncomeCounterpart(type: string): boolean {
  return type === "unknown" || type === "revenue" || type === "tumbler";
}

export function assertAllowedTransactionPair(source: Account, dest: Account): void {
  if (source.userId !== dest.userId) {
    throw new ValidationError("Accounts belong to different users.");
  }
  if (source.id === dest.id) {
    throw new ValidationError("Source and destination accounts must differ.");
  }

  const sourceInstrument = isInstrumentAccountType(source.accountType);
  const destInstrument = isInstrumentAccountType(dest.accountType);

  if (sourceInstrument && destInstrument) {
    return;
  }
  if (sourceInstrument && isSpendCounterpart(dest.accountType)) {
    return;
  }
  if (destInstrument && isIncomeCounterpart(source.accountType)) {
    return;
  }

  throw new ValidationError("Account pair is invalid.");
}

export async function computeBalanceAsOf(
  transactions: TransactionRepository,
  userId: string,
  accountId: string,
  on: string
): Promise<number> {
  const snapshot = await transactions.latestMonthlySummaryBefore(userId, accountId, on);
  let balance = snapshot?.amountClosing ?? 0;
  const fromExclusive = snapshot?.periodEnd ?? null;
  const partial = await transactions.sumAmounts({
    userId,
    accountId,
    after: fromExclusive ?? undefined,
    onOrBefore: on,
  });
  if (!snapshot) {
    return partial.amountCredit - partial.amountDebit;
  }
  balance += partial.amountCredit - partial.amountDebit;
  return balance;
}
