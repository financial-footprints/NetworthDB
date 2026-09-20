import { MAX_TAGS_PER_TRANSACTION } from "@core/domains/account/taxonomy/constants";
import { MAX_BATCH_SIZE } from "@core/domains/account/transactions/constants";
import { accountIdParamsSchema } from "@platform/http/endpoints/accounts/index";
import {
  detailsResponseSchema,
  pageLimitSchema,
  paginatedListResponseSchema,
} from "@platform/http/envelopes";
import {
  optionalIsoDateRangeObjectSchema,
  withOptionalIsoDateRangeRefine,
} from "@platform/schema/date-range-query";
import { isoDateFieldSchema } from "@platform/schema/iso-date";
import { z } from "zod";

const transactionIsoDateFieldSchema = isoDateFieldSchema("Date is invalid.");

const taxonomyWriteFields = {
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(MAX_TAGS_PER_TRANSACTION).optional(),
};

const transactionWriteFields = {
  date: transactionIsoDateFieldSchema,
  amount: z.number().int().positive(),
  sourceAccountId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  description: z.string().min(1),
  refNo: z.string().nullable().optional(),
  ...taxonomyWriteFields,
};

export const createTransactionReqSchema = z.object({
  ...transactionWriteFields,
  importId: z.string().uuid().nullable().optional(),
});

export const patchTransactionReqSchema = z.object(transactionWriteFields);

export const bulkUpdateTransactionsReqSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        ...transactionWriteFields,
      })
    )
    .min(1)
    .max(MAX_BATCH_SIZE),
});

export const bulkUpdateTransactionsSchema = detailsResponseSchema(
  z.object({
    updated: z.number().int().nonnegative(),
  })
);

export const bulkDeleteTransactionsReqSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_BATCH_SIZE),
});

export const bulkDeleteTransactionsSchema = detailsResponseSchema(
  z.object({
    deleted: z.number().int().nonnegative(),
  })
);

export const batchTransactionsReqSchema = z.object({
  importId: z.string().uuid(),
  items: z.array(createTransactionReqSchema).min(1).max(MAX_BATCH_SIZE),
});

const transactionListFilterFields = {
  word: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  sourceAccountId: z.string().uuid().optional(),
  destinationAccountId: z.string().uuid().optional(),
  amountMin: z.coerce.number().int().positive().optional(),
  amountMax: z.coerce.number().int().positive().optional(),
};

function refineTransactionAmountRange<T extends z.ZodTypeAny>(
  schema: T,
  message = "Minimum amount must be less than or equal to maximum amount."
) {
  return schema.superRefine((value, ctx) => {
    const row = value as { amountMin?: number; amountMax?: number };
    if (
      row.amountMin !== undefined &&
      row.amountMax !== undefined &&
      row.amountMin > row.amountMax
    ) {
      ctx.addIssue({ code: "custom", message });
    }
  });
}

export const transactionListQuerySchema = refineTransactionAmountRange(
  withOptionalIsoDateRangeRefine(
    optionalIsoDateRangeObjectSchema("Date is invalid.").extend({
      ...transactionListFilterFields,
      limit: pageLimitSchema({ max: 10_000, defaultLimit: 100 }),
      offset: z.coerce.number().int().nonnegative().default(0),
    })
  )
);

export const transactionBalanceQuerySchema = z.object({
  on: transactionIsoDateFieldSchema,
});

export const transactionSummaryQuerySchema = refineTransactionAmountRange(
  withOptionalIsoDateRangeRefine(
    optionalIsoDateRangeObjectSchema("Date is invalid.").extend(transactionListFilterFields)
  )
);

export const transactionIdParamsSchema = accountIdParamsSchema.extend({
  transactionId: z.string().uuid(),
});

export const importIdParamsSchema = accountIdParamsSchema.extend({
  importId: z.string().uuid(),
});

const transactionPartySchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  accountType: z.string(),
});

const taxonomyRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const transactionDataSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  amount: z.number().int(),
  source: transactionPartySchema,
  destination: transactionPartySchema,
  description: z.string(),
  refNo: z.string().nullable(),
  importId: z.string().uuid().nullable(),
  category: taxonomyRefSchema.nullable(),
  subcategory: taxonomyRefSchema.nullable(),
  tags: z.array(taxonomyRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const transactionSchema = detailsResponseSchema(transactionDataSchema);
export const transactionListSchema = paginatedListResponseSchema(transactionDataSchema);

export const transactionImportSchema = detailsResponseSchema(
  z.object({
    id: z.string().uuid(),
    accountId: z.string().uuid(),
    createdAt: z.string(),
  })
);

export const rangeSummarySchema = detailsResponseSchema(
  z.object({
    from: z.string(),
    to: z.string(),
    opening: z.number().int(),
    closing: z.number().int(),
    amountCredit: z.number().int(),
    amountDebit: z.number().int(),
    txnCount: z.number().int(),
  })
);

export const balanceSchema = detailsResponseSchema(
  z.object({
    on: z.string(),
    balance: z.number().int(),
  })
);

export const systemAccountsSchema = detailsResponseSchema(
  z.object({
    items: z.array(
      z.object({
        id: z.string().uuid(),
        label: z.string(),
        accountType: z.string(),
      })
    ),
  })
);

export const transactionsSyncReqSchema = z.object({
  period: z.string().min(1),
  transactionsSynced: z.boolean(),
  transactionsImportId: z.string().uuid().nullable(),
});
