import { createSessionRouter, errorResponses } from "@api/config/router";
import {
  readFileField,
  readOptionalStringField,
  readStringField,
} from "@api/routes/accounts/helpers";
import { jsonMedia } from "@api/routes/auth/helpers";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  accountFileDownloadParamsSchema,
  accountFileDownloadQuerySchema,
  jobCreatedSchema,
} from "@ndb/platform";

const UPLOAD_ERROR_PREFIX = "api.accounts.upload.invalid";

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

      const accountId = readStringField(body, "account_id", UPLOAD_ERROR_PREFIX);
      const format = readStringField(body, "format", UPLOAD_ERROR_PREFIX);
      const file = readFileField(body, "file", `${UPLOAD_ERROR_PREFIX}.file-required`);
      const statementKind = readOptionalStringField(body, "statement_kind", UPLOAD_ERROR_PREFIX);
      const coveredMonth = readOptionalStringField(body, "covered_month", UPLOAD_ERROR_PREFIX);
      const yearKey = readOptionalStringField(body, "year_key", UPLOAD_ERROR_PREFIX);

      const content = Buffer.from(await file.arrayBuffer());
      const result = await c.get("services").account.uploadStatement(user, auth.acr, {
        accountId,
        format,
        filename: file.name,
        content,
        statementKind: statementKind ?? undefined,
        coveredMonth,
        yearKey,
      });

      return c.json(
        jobCreatedSchema.parse({
          data: { id: result.jobId },
          errors: [],
        }),
        202
      );
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.accounts.files.download,
      request: {
        params: accountFileDownloadParamsSchema,
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
      const { id } = c.req.valid("param");
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").account.downloadStatement(user, auth.acr, {
        accountId: id,
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
