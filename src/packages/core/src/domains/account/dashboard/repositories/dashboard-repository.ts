import type { DashboardRangeAggregates, SeriesBucket } from "@core/domains/account/dashboard/types";

export interface DashboardRepository {
  aggregateRange(
    userId: string,
    from: string | undefined,
    to: string | undefined,
    bucket: SeriesBucket
  ): Promise<DashboardRangeAggregates>;
}
