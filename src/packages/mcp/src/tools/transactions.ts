import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod, stripUndefined } from "@mcp/tools/helpers";
import {
  accountIdField,
  amountPaiseField,
  importIdField,
  isoDateField,
  transactionIdField,
} from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { MAX_BATCH_SIZE, MAX_TAGS_PER_TRANSACTION } from "@ndb/core";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const TRANSACTION_TOOL_NAMES = [
  "transactions_list",
  "transactions_create",
  "transactions_patch",
  "transactions_delete",
  "transactions_batch",
  "transactions_bulk",
  "transactions_bulk_delete",
  "transactions_summary",
  "transactions_balance",
  "transactions_import_create",
  "transactions_import_delete",
] as const;

const taxonomyFields = {
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(MAX_TAGS_PER_TRANSACTION).optional(),
};

const transactionWriteSchema = z.object({
  date: isoDateField,
  amount: amountPaiseField,
  sourceAccountId: accountIdField.describe("Debit/source side of the transfer."),
  destinationAccountId: accountIdField.describe("Credit/destination side of the transfer."),
  description: z.string().min(1).describe("Plaintext transaction description."),
  refNo: z.string().nullable().optional().describe("Optional reference number."),
  ...taxonomyFields,
});

const accountIdArgSchema = z.object({
  id: accountIdField.describe("Ledger account id (scope for list/create/summary/balance)."),
});

const transactionsListSchema = accountIdArgSchema.extend({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  word: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  sourceAccountId: z.string().uuid().optional(),
  destinationAccountId: z.string().uuid().optional(),
  amountMin: z.number().int().positive().optional(),
  amountMax: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

const transactionsCreateSchema = accountIdArgSchema.extend({
  importId: importIdField.nullable().optional(),
  ...transactionWriteSchema.shape,
});

const transactionsPatchSchema = accountIdArgSchema.extend({
  transactionId: transactionIdField,
  ...transactionWriteSchema.shape,
});

const transactionsDeleteSchema = accountIdArgSchema.extend({
  transactionId: transactionIdField,
});

const transactionsBatchSchema = accountIdArgSchema.extend({
  importId: importIdField,
  items: z.array(transactionWriteSchema).min(1).max(MAX_BATCH_SIZE),
});

const transactionsBulkSchema = accountIdArgSchema.extend({
  items: z
    .array(
      transactionWriteSchema.extend({
        id: transactionIdField,
      })
    )
    .min(1)
    .max(MAX_BATCH_SIZE),
});

const transactionsBulkDeleteSchema = accountIdArgSchema.extend({
  ids: z.array(transactionIdField).min(1).max(MAX_BATCH_SIZE),
});

const transactionsSummarySchema = accountIdArgSchema.extend({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  word: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  sourceAccountId: z.string().uuid().optional(),
  destinationAccountId: z.string().uuid().optional(),
  amountMin: z.number().int().positive().optional(),
  amountMax: z.number().int().positive().optional(),
});

const transactionsBalanceSchema = accountIdArgSchema.extend({
  on: isoDateField.describe("Balance as-of calendar date."),
});

const transactionsImportDeleteSchema = accountIdArgSchema.extend({
  importId: importIdField,
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.transactions.missing-catalog.${name}`);
  }
  return entry;
}

function txnPath(accountId: string, transactionId: string): string {
  return apiPath(API.accounts.transactions.patch, { accountId, transactionId });
}

export function createTransactionTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("transactions_list"),
      schema: transactionsListSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...query } = input;
        const path = appendQuery(
          apiPath(API.accounts.transactions.list, { accountId: id }),
          stripUndefined({
            from: query.from,
            to: query.to,
            word: query.word,
            categoryId: query.categoryId,
            subcategoryId: query.subcategoryId,
            tagId: query.tagId,
            sourceAccountId: query.sourceAccountId,
            destinationAccountId: query.destinationAccountId,
            amountMin: query.amountMin,
            amountMax: query.amountMax,
            limit: query.limit !== undefined ? String(query.limit) : undefined,
            offset: query.offset !== undefined ? String(query.offset) : undefined,
          })
        );
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_create"),
      schema: transactionsCreateSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...body } = input;
        return session.requestJson(
          "POST",
          apiPath(API.accounts.transactions.create, { accountId: id }),
          stripUndefined(body)
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_patch"),
      schema: transactionsPatchSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, transactionId, ...body } = input;
        return session.requestJson("PATCH", txnPath(id, transactionId), stripUndefined(body));
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_delete"),
      schema: transactionsDeleteSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson(
          "DELETE",
          apiPath(API.accounts.transactions.delete, {
            accountId: input.id,
            transactionId: input.transactionId,
          })
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_batch"),
      schema: transactionsBatchSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, importId, items } = input;
        return session.requestJson(
          "POST",
          apiPath(API.accounts.transactions.batch, { accountId: id }),
          {
            importId,
            items,
          }
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_bulk"),
      schema: transactionsBulkSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, items } = input;
        return session.requestJson(
          "POST",
          apiPath(API.accounts.transactions.bulk, { accountId: id }),
          { items }
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_bulk_delete"),
      schema: transactionsBulkDeleteSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ids } = input;
        return session.requestJson(
          "POST",
          apiPath(API.accounts.transactions.bulkDelete, { accountId: id }),
          { ids }
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_summary"),
      schema: transactionsSummarySchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(
          apiPath(API.accounts.transactions.summary, { accountId: input.id }),
          stripUndefined({
            from: input.from,
            to: input.to,
            word: input.word,
            categoryId: input.categoryId,
            subcategoryId: input.subcategoryId,
            tagId: input.tagId,
            sourceAccountId: input.sourceAccountId,
            destinationAccountId: input.destinationAccountId,
            amountMin: input.amountMin,
            amountMax: input.amountMax,
          })
        );
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_balance"),
      schema: transactionsBalanceSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(
          apiPath(API.accounts.transactions.balance, { accountId: input.id }),
          {
            on: input.on,
          }
        );
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_import_create"),
      schema: accountIdArgSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson(
          "POST",
          apiPath(API.accounts.transactionImports.create, { accountId: input.id })
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("transactions_import_delete"),
      schema: transactionsImportDeleteSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson(
          "DELETE",
          apiPath(API.accounts.transactionImports.delete, {
            accountId: input.id,
            importId: input.importId,
          })
        );
      },
    }),
  ];
}
