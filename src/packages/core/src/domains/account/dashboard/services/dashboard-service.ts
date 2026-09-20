import { INSTRUMENT_ACCOUNT_TYPES } from "@core/domains/account/constants";
import { chooseSeriesBucket, fillSeries } from "@core/domains/account/dashboard/helpers";
import type { DashboardRepository } from "@core/domains/account/dashboard/repositories/dashboard-repository";
import type { DashboardSnapshot } from "@core/domains/account/dashboard/types";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { computeBalanceAsOf } from "@core/domains/account/transactions/helpers";
import type { TransactionRepository } from "@core/domains/account/transactions/repositories/transaction-repository";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { User } from "@core/domains/user/entities/user/index";
import { ValidationError } from "@core/shared/errors/domain-error";
import { Time } from "@core/shared/time";

export class DashboardService {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly accounts: AccountRepository,
    private readonly transactions: TransactionRepository
  ) {}

  async getSnapshot(
    user: User,
    authAcr: string,
    from?: string,
    to?: string
  ): Promise<DashboardSnapshot> {
    assertAal2(user.multifactorEnabled, authAcr);

    const unbounded = from === undefined && to === undefined;
    let effectiveFrom = from;
    let effectiveTo = to;
    if (unbounded) {
      effectiveTo = Time.utcTodayIsoDate();
      const extent = await this.transactions.getDateExtent({ userId: user.id });
      effectiveFrom = extent.min ?? effectiveTo;
    } else if (!effectiveFrom || !effectiveTo) {
      throw new ValidationError("Date range is invalid.", {
        field: "from",
        context: { from, to },
      });
    }

    if (Time.compareIsoDates(effectiveFrom, effectiveTo) > 0) {
      throw new ValidationError("Date range is invalid.", {
        field: "from",
        context: { from: effectiveFrom, to: effectiveTo },
      });
    }

    const bucket = chooseSeriesBucket(effectiveFrom, effectiveTo);
    const [aggregates, instruments] = await Promise.all([
      this.dashboard.aggregateRange(
        user.id,
        unbounded ? undefined : effectiveFrom,
        unbounded ? undefined : effectiveTo,
        bucket
      ),
      this.accounts.findByFilters({
        userId: user.id,
        accountTypes: INSTRUMENT_ACCOUNT_TYPES,
      }),
    ]);
    const series = fillSeries(effectiveFrom, effectiveTo, bucket, aggregates.series);

    const openingOn = Time.addIsoCalendarDays(effectiveFrom, -1);
    let opening = 0;
    let closing = 0;
    const closingByType = new Map<string, number>();

    for (const account of instruments) {
      const [openBal, closeBal] = await Promise.all([
        computeBalanceAsOf(this.transactions, user.id, account.id, openingOn),
        computeBalanceAsOf(this.transactions, user.id, account.id, effectiveTo),
      ]);
      opening += openBal;
      closing += closeBal;
      const prev = closingByType.get(account.accountType) ?? 0;
      closingByType.set(account.accountType, prev + closeBal);
    }

    const byType = [...closingByType.entries()]
      .map(([accountType, amount]) => ({ accountType, amount }))
      .sort((a, b) => a.accountType.localeCompare(b.accountType));

    const cashflow = {
      ...aggregates.cashflow,
      net: aggregates.cashflow.income - aggregates.cashflow.spend,
    };

    return {
      period: { from: effectiveFrom, to: effectiveTo, bucket },
      cashflow,
      spendByCategory: aggregates.spendByCategory,
      spendBySubcategory: aggregates.spendBySubcategory,
      spendByAccount: aggregates.spendByAccount,
      incomeByCategory: aggregates.incomeByCategory,
      series,
      netWorth: {
        opening,
        closing,
        change: closing - opening,
        byType,
      },
    };
  }
}
