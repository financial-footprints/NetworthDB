import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia } from "@api/routes/auth/helpers";
import { sessionPrincipal } from "@ndb/middleware";
import { API, statementSyncCreatedSchema, statementSyncReqSchema } from "@ndb/platform";

const syncRoutes = createSessionRouter().endpoint(
  {
    method: "post",
    path: API.accounts.statements.sync,
    request: { body: jsonBody(statementSyncReqSchema) },
    responses: {
      202: {
        content: jsonMedia(statementSyncCreatedSchema),
        description: "Statement sync job accepted",
      },
      400: errorResponses[400],
      401: errorResponses[401],
      409: errorResponses[409],
    },
  },
  async (c) => {
    const body = c.req.valid("json");
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const result = await c.get("services").account.syncStatements(user, auth.acr, {
      accountId: body.accountId,
      financialYear: body.financialYear,
    });

    return c.json(
      statementSyncCreatedSchema.parse({
        data: { id: result.jobId },
        errors: [],
      }),
      202
    );
  }
);

export default syncRoutes;
