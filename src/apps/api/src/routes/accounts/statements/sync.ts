import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeJobCreated } from "@api/routes/jobs/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, jobCreatedSchema, statementSyncReqSchema } from "@ndb/platform";

const syncRoutes = createSessionRouter().endpoint(
  {
    method: "post",
    path: API.accounts.statements.sync,
    request: { body: jsonBody(statementSyncReqSchema) },
    responses: {
      202: {
        content: jsonMedia(jobCreatedSchema),
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
    const result = await c.get("services").accountService.pipeline.sync(user, auth.acr, {
      accountId: body.accountId,
      financialYear: body.financialYear,
    });

    return c.json(serializeJobCreated(result.jobId), 202);
  }
);

export default syncRoutes;
