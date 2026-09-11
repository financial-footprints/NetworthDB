import type { AuthEnv } from "@api/config/hono-env";
import { ApiRouter, createSessionRouter, errorResponses } from "@api/config/router";
import banksRoutes from "@api/routes/accounts/banks/index";
import filesRoutes from "@api/routes/accounts/files/index";
import metadataRoutes from "@api/routes/accounts/metadata/index";
import { serializeAccount, serializeAccountList } from "@api/routes/accounts/serializer";
import syncRoutes from "@api/routes/accounts/statements/sync";
import { jsonBody, jsonMedia } from "@api/routes/auth/helpers";
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
      const result = await c.get("services").account.list(user, auth.acr, {
        accountType: query.account_type,
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
      const account = await c.get("services").account.create(user, auth.acr, {
        bank: body.bank,
        variant: body.variant,
        accountType: body.accountType,
        openingDate: body.openingDate,
        closingDate: body.closingDate,
        accountNumber: body.accountNumber,
        passwords: body.passwords,
        mail: body.mail,
        statement: body.statement,
      });
      return c.json(serializeAccount(account, includeSecrets), 201);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.accounts.details,
      request: { params: accountIdParamsSchema },
      responses: {
        200: { content: jsonMedia(accountSchema), description: "Account details" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { id } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const account = await c.get("services").account.get(user, auth.acr, id);
      return c.json(serializeAccount(account, includeSecrets), 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.accounts.details,
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
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const account = await c.get("services").account.update(user, auth.acr, id, {
        bank: body.bank,
        variant: body.variant,
        accountType: body.accountType,
        openingDate: body.openingDate,
        closingDate: body.closingDate,
        accountNumber: body.accountNumber,
        passwords: body.passwords,
        mail: body.mail,
        statement: body.statement,
      });
      return c.json(serializeAccount(account, includeSecrets), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.accounts.details,
      request: { params: accountIdParamsSchema },
      responses: {
        204: { description: "Account deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { id } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").account.delete(user, auth.acr, id);
      return c.body(null, 204);
    }
  );

const accountRoutes = new ApiRouter<AuthEnv>()
  .route("/", banksRoutes)
  .route("/", metadataRoutes)
  .route("/", filesRoutes)
  .route("/", syncRoutes)
  .route("/", accountCrudRoutes);

export default accountRoutes;
