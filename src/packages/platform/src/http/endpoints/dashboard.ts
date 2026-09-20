import { detailsResponseSchema } from "@platform/http/envelopes";
import { optionalIsoDateRangeQuerySchema } from "@platform/schema/date-range-query";
import { z } from "zod";

export const dashboardQuerySchema = optionalIsoDateRangeQuerySchema(
  "From date is invalid.",
  "Date range is invalid."
);

const dashboardNamedAmountSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string(),
  parentId: z.string().uuid().nullable(),
  amount: z.number().int(),
  txnCount: z.number().int(),
});

const dashboardAccountAmountSchema = z.object({
  accountId: z.string().uuid(),
  label: z.string(),
  accountType: z.string(),
  amount: z.number().int(),
  txnCount: z.number().int(),
});

const dashboardSeriesPointSchema = z.object({
  bucketStart: z.string(),
  income: z.number().int(),
  spend: z.number().int(),
});

const dashboardSnapshotDataSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
    bucket: z.enum(["day", "week", "month"]),
  }),
  cashflow: z.object({
    income: z.number().int(),
    spend: z.number().int(),
    net: z.number().int(),
    transfer: z.number().int(),
    incomeCount: z.number().int(),
    spendCount: z.number().int(),
    transferCount: z.number().int(),
    uncategorizedSpend: z.number().int(),
    uncategorizedSpendCount: z.number().int(),
    unknownCounterpart: z.number().int(),
    unknownCounterpartCount: z.number().int(),
  }),
  spendByCategory: z.array(dashboardNamedAmountSchema),
  spendBySubcategory: z.array(dashboardNamedAmountSchema),
  spendByAccount: z.array(dashboardAccountAmountSchema),
  incomeByCategory: z.array(dashboardNamedAmountSchema),
  series: z.array(dashboardSeriesPointSchema),
  netWorth: z.object({
    opening: z.number().int(),
    closing: z.number().int(),
    change: z.number().int(),
    byType: z.array(
      z.object({
        accountType: z.string(),
        amount: z.number().int(),
      })
    ),
  }),
});

export const dashboardSnapshotSchema = detailsResponseSchema(dashboardSnapshotDataSchema);
