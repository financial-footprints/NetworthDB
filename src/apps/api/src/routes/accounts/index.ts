import type { AuthEnv } from "@api/config/hono-env";
import { jsonBody, jsonMedia } from "@api/config/http";
import { ApiRouter, createSessionRouter, errorResponses } from "@api/config/router";
import banksRoutes from "@api/routes/accounts/banks/index";
import filesRoutes from "@api/routes/accounts/files/index";
import metadataRoutes from "@api/routes/accounts/metadata/index";
import { serializeAccount, serializeAccountList } from "@api/routes/accounts/serializer";
import syncRoutes from "@api/routes/accounts/statements/sync";
import systemRoutes from "@api/routes/accounts/system";
import transactionRoutes from "@api/routes/accounts/transactions/index";
import type { AccountSortColumn, Sort } from "@ndb/core";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  accountIdParamsSchema,
  accountListQuerySchema,
  accountListSchema,
  accountSchema,
  createAccountReqSchema,
  patchAccountReqSchema,
} from "@ndb/platform";

function toAccountListSort(query: {
  sort?: "label" | "accountType" | "currentBalance";
  direction?: "asc" | "desc";
}): Sort<AccountSortColumn> | undefined {
  if (!query.sort) {
    return undefined;
  }

  const columnMap: Record<"label" | "accountType" | "currentBalance", AccountSortColumn> = {
    label: "label",
    accountType: "accountType",
    currentBalance: "currentBalance",
  };

  return {
    column: columnMap[query.sort],
    direction: query.direction ?? "asc",
  };
}

const accountCrudRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.accounts.list,
      request: { query: accountListQuerySchema },
      responses: {
        200: { content: jsonMedia(accountListSchema), description: "Account list" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const result = await c.get("services").accountService.list(user, auth.acr, {
        accountType: query.accountType,
        listStatus: query.status,
        q: query.q,
        sort: toAccountListSort(query),
      });
      return c.json(serializeAccountList(result.items, result.total, includeSecrets), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.accounts.create,
      request: { body: jsonBody(createAccountReqSchema) },
      responses: {
        201: { content: jsonMedia(accountSchema), description: "Account created" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const account = await c.get("services").accountService.create(user, auth.acr, body);
      return c.json(serializeAccount(account, includeSecrets), 201);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.accounts.get,
      request: { params: accountIdParamsSchema },
      responses: {
        200: { content: jsonMedia(accountSchema), description: "Account details" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const account = await c.get("services").accountService.get(user, auth.acr, accountId);
      return c.json(serializeAccount(account, includeSecrets), 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.accounts.patch,
      request: {
        params: accountIdParamsSchema,
        body: jsonBody(patchAccountReqSchema),
      },
      responses: {
        200: { content: jsonMedia(accountSchema), description: "Account updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const account = await c
        .get("services")
        .accountService.update(user, auth.acr, accountId, body);
      return c.json(serializeAccount(account, includeSecrets), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.accounts.delete,
      request: { params: accountIdParamsSchema },
      responses: {
        204: { description: "Account deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").accountService.delete(user, auth.acr, accountId);
      return c.body(null, 204);
    }
  );

const accountRoutes = new ApiRouter<AuthEnv>()
  .route("/", banksRoutes)
  .route("/", systemRoutes)
  .route("/", metadataRoutes)
  .route("/", filesRoutes)
  .route("/", syncRoutes)
  .route("/", transactionRoutes)
  .route("/", accountCrudRoutes);

export default accountRoutes;
