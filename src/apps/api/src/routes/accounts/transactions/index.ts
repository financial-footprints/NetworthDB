import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import {
  nullableTransactionResponseSchema,
  serializeBalance,
  serializeImport,
  serializeNullableTransactionResponse,
  serializeRangeSummary,
  serializeTransaction,
  serializeTransactionList,
} from "@api/routes/accounts/transactions/serializer";
import { getCreditCardTitleMap } from "@api/routes/credit-cards/cache";
import type { Account, Category, Tag } from "@ndb/core";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  accountIdParamsSchema,
  balanceSchema,
  batchTransactionsReqSchema,
  bulkDeleteTransactionsReqSchema,
  bulkDeleteTransactionsSchema,
  bulkUpdateTransactionsReqSchema,
  bulkUpdateTransactionsSchema,
  createTransactionReqSchema,
  importIdParamsSchema,
  patchTransactionReqSchema,
  rangeSummarySchema,
  transactionBalanceQuerySchema,
  transactionIdParamsSchema,
  transactionImportSchema,
  transactionListQuerySchema,
  transactionListSchema,
  transactionSchema,
  transactionSummaryQuerySchema,
  transactionsSyncReqSchema,
} from "@ndb/platform";

type TxnRouteServices = {
  accountService: { mapById: (userId: string) => Promise<Map<string, Account>> };
  categoryService: { mapById: (userId: string) => Promise<Map<string, Category>> };
  tagService: { mapById: (userId: string) => Promise<Map<string, Tag>> };
};

async function accountsMap(
  c: { get: (key: "services") => TxnRouteServices },
  userId: string
): Promise<Map<string, Account>> {
  return c.get("services").accountService.mapById(userId);
}

async function taxonomyMaps(
  c: { get: (key: "services") => TxnRouteServices },
  userId: string
): Promise<{ categories: Map<string, Category>; tags: Map<string, Tag> }> {
  const services = c.get("services");
  const [categories, tags] = await Promise.all([
    services.categoryService.mapById(userId),
    services.tagService.mapById(userId),
  ]);
  return { categories, tags };
}

const transactionRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.accounts.transactions.list,
      request: { params: accountIdParamsSchema, query: transactionListQuerySchema },
      responses: {
        200: { content: jsonMedia(transactionListSchema), description: "Transaction list" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const [result, lookup, taxonomy, catalogTitles] = await Promise.all([
        c.get("services").transactionService.listInRange(
          user,
          auth.acr,
          accountId,
          {
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
          },
          { limit: query.limit, offset: query.offset }
        ),
        accountsMap(c, user.id),
        taxonomyMaps(c, user.id),
        getCreditCardTitleMap(),
      ]);
      return c.json(
        serializeTransactionList(
          result.items,
          result.total,
          lookup,
          taxonomy.categories,
          taxonomy.tags,
          catalogTitles
        ),
        200
      );
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.accounts.transactions.create,
      request: { params: accountIdParamsSchema, body: jsonBody(createTransactionReqSchema) },
      responses: {
        200: {
          content: jsonMedia(nullableTransactionResponseSchema),
          description: "Transaction skipped (rule delete)",
        },
        201: {
          content: jsonMedia(transactionSchema),
          description: "Transaction created",
        },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const txn = await c
        .get("services")
        .transactionService.create(user, auth.acr, accountId, body);
      if (txn === null) {
        return c.json(serializeNullableTransactionResponse(), 200);
      }
      const [lookup, taxonomy, catalogTitles] = await Promise.all([
        accountsMap(c, user.id),
        taxonomyMaps(c, user.id),
        getCreditCardTitleMap(),
      ]);
      return c.json(
        serializeTransaction(txn, lookup, taxonomy.categories, taxonomy.tags, catalogTitles),
        201
      );
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.accounts.transactions.batch,
      request: { params: accountIdParamsSchema, body: jsonBody(batchTransactionsReqSchema) },
      responses: {
        201: { content: jsonMedia(transactionListSchema), description: "Transactions batch" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const items = await c
        .get("services")
        .transactionService.createMany(user, auth.acr, accountId, body.importId, body.items);
      const [lookup, taxonomy, catalogTitles] = await Promise.all([
        accountsMap(c, user.id),
        taxonomyMaps(c, user.id),
        getCreditCardTitleMap(),
      ]);
      return c.json(
        serializeTransactionList(
          items,
          items.length,
          lookup,
          taxonomy.categories,
          taxonomy.tags,
          catalogTitles
        ),
        201
      );
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.accounts.transactions.bulk,
      request: {
        params: accountIdParamsSchema,
        body: jsonBody(bulkUpdateTransactionsReqSchema),
      },
      responses: {
        200: {
          content: jsonMedia(bulkUpdateTransactionsSchema),
          description: "Transactions updated",
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const updated = await c.get("services").transactionService.updateMany(
        user,
        auth.acr,
        accountId,
        body.items.map((item) => ({
          id: item.id,
          date: item.date,
          amount: item.amount,
          sourceAccountId: item.sourceAccountId,
          destinationAccountId: item.destinationAccountId,
          description: item.description,
          refNo: item.refNo,
          categoryId: item.categoryId === undefined ? null : item.categoryId,
          subcategoryId: item.subcategoryId === undefined ? null : item.subcategoryId,
          tagIds: item.tagIds ?? [],
        }))
      );
      return c.json({ data: { updated } }, 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.accounts.transactions.bulkDelete,
      request: {
        params: accountIdParamsSchema,
        body: jsonBody(bulkDeleteTransactionsReqSchema),
      },
      responses: {
        200: {
          content: jsonMedia(bulkDeleteTransactionsSchema),
          description: "Transactions deleted",
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const deleted = await c
        .get("services")
        .transactionService.deleteMany(user, auth.acr, accountId, body.ids);
      return c.json({ data: { deleted } }, 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.accounts.transactions.patch,
      request: { params: transactionIdParamsSchema, body: jsonBody(patchTransactionReqSchema) },
      responses: {
        200: { content: jsonMedia(transactionSchema), description: "Transaction updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId, transactionId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const txn = await c
        .get("services")
        .transactionService.update(user, auth.acr, accountId, transactionId, {
          date: body.date,
          amount: body.amount,
          sourceAccountId: body.sourceAccountId,
          destinationAccountId: body.destinationAccountId,
          description: body.description,
          refNo: body.refNo,
          categoryId: body.categoryId === undefined ? null : body.categoryId,
          subcategoryId: body.subcategoryId === undefined ? null : body.subcategoryId,
          tagIds: body.tagIds ?? [],
        });
      const [lookup, taxonomy, catalogTitles] = await Promise.all([
        accountsMap(c, user.id),
        taxonomyMaps(c, user.id),
        getCreditCardTitleMap(),
      ]);
      return c.json(
        serializeTransaction(txn, lookup, taxonomy.categories, taxonomy.tags, catalogTitles),
        200
      );
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.accounts.transactions.summary,
      request: { params: accountIdParamsSchema, query: transactionSummaryQuerySchema },
      responses: {
        200: { content: jsonMedia(rangeSummarySchema), description: "Range summary" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const summary = await c
        .get("services")
        .transactionService.summarizeRange(user, auth.acr, accountId, {
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
        });
      return c.json(serializeRangeSummary(summary), 200);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.accounts.transactions.balance,
      request: { params: accountIdParamsSchema, query: transactionBalanceQuerySchema },
      responses: {
        200: { content: jsonMedia(balanceSchema), description: "Balance as of date" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const balance = await c
        .get("services")
        .transactionService.balanceAsOf(user, auth.acr, accountId, query.on);
      return c.json(serializeBalance(query.on, balance), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.accounts.transactions.delete,
      request: { params: transactionIdParamsSchema },
      responses: {
        204: { description: "Transaction deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId, transactionId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").transactionService.delete(user, auth.acr, accountId, transactionId);
      return c.body(null, 204);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.accounts.transactionImports.create,
      request: { params: accountIdParamsSchema },
      responses: {
        201: { content: jsonMedia(transactionImportSchema), description: "Import batch created" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const row = await c
        .get("services")
        .transactionService.createImport(user, auth.acr, accountId);
      return c.json(serializeImport(row), 201);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.accounts.transactionImports.delete,
      request: { params: importIdParamsSchema },
      responses: {
        204: { description: "Import batch deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId, importId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").transactionService.deleteImport(user, auth.acr, accountId, importId);
      return c.body(null, 204);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.accounts.statements.transactionsSync,
      request: { params: accountIdParamsSchema, body: jsonBody(transactionsSyncReqSchema) },
      responses: {
        204: { description: "Statement transactions sync updated" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const account = await c.get("services").accountService.get(user, auth.acr, accountId);
      await c.get("services").accountService.statements.setTransactionsSync(user.id, account, body);
      return c.body(null, 204);
    }
  );

export default transactionRoutes;
