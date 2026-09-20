import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import {
  readFileField,
  readOptionalStringField,
  readStringField,
} from "@api/routes/accounts/helpers";
import { serializeJobCreated } from "@api/routes/jobs/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  accountFileDownloadQuerySchema,
  accountIdParamsSchema,
  jobCreatedSchema,
} from "@ndb/platform";

const filesRoutes = createSessionRouter()
  .endpoint(
    {
      method: "post",
      path: API.accounts.files.upload,
      responses: {
        202: { content: jsonMedia(jobCreatedSchema), description: "Upload accepted" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const body = await c.req.parseBody();
      const { user, auth } = sessionPrincipal(c.get("principal"));

      const accountId = readStringField(body, "account_id");
      const format = readStringField(body, "format");
      const file = readFileField(body, "file");
      const statementKind = readOptionalStringField(body, "statement_kind");
      const coveredMonth = readOptionalStringField(body, "covered_month");
      const yearKey = readOptionalStringField(body, "year_key");

      const content = Buffer.from(await file.arrayBuffer());
      const result = await c.get("services").accountService.statements.upload(user, auth.acr, {
        accountId,
        format,
        filename: file.name,
        content,
        statementKind: statementKind ?? undefined,
        coveredMonth,
        yearKey,
      });

      return c.json(serializeJobCreated(result.jobId), 202);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.accounts.files.download,
      request: {
        params: accountIdParamsSchema,
        query: accountFileDownloadQuerySchema,
      },
      responses: {
        200: { description: "Statement file" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { accountId } = c.req.valid("param");
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").accountService.statements.download(user, auth.acr, {
        accountId,
        statementDate: query.statementDate,
        format: query.format,
      });

      return new Response(result.buffer, {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
        },
      });
    }
  );

export default filesRoutes;
