import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { readFileField, readOptionalStringField } from "@api/routes/accounts/helpers";
import { serializeBackupExportStatus } from "@api/routes/backup/serializer";
import { serializeJobCreated } from "@api/routes/jobs/serializer";
import { BACKUP_ZIP_PASSWORD_MIN_LEN, ValidationError } from "@ndb/core";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  backupExportBodySchema,
  backupExportStatusSchema,
  jobCreatedSchema,
} from "@ndb/platform";

const backupRoutes = createSessionRouter()
  .endpoint(
    {
      method: "post",
      path: API.backup.export,
      request: { body: jsonBody(backupExportBodySchema) },
      responses: {
        202: { content: jsonMedia(jobCreatedSchema), description: "Backup export accepted" },
        400: errorResponses[400],
        401: errorResponses[401],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c
        .get("services")
        .backupService.exportBackup(user, auth.acr, body.password);
      return c.json(serializeJobCreated(result.jobId), 202);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.backup.import,
      responses: {
        202: { content: jsonMedia(jobCreatedSchema), description: "Backup import accepted" },
        400: errorResponses[400],
        401: errorResponses[401],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const body = await c.req.parseBody();
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const file = readFileField(body, "file");
      const password = readOptionalStringField(body, "password")?.trim() ?? "";
      if (password.length < BACKUP_ZIP_PASSWORD_MIN_LEN) {
        throw new ValidationError("Password is too short.", { field: "password" });
      }
      const zipPath = join(tmpdir(), `ndb-backup-import-${crypto.randomUUID()}.zip`);
      await writeFile(zipPath, new Uint8Array(await file.arrayBuffer()));
      try {
        const result = await c
          .get("services")
          .backupService.importBackup(user, auth.acr, zipPath, password);
        return c.json(serializeJobCreated(result.jobId), 202);
      } catch (error) {
        await rm(zipPath, { force: true });
        throw error;
      }
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.backup.get,
      responses: {
        200: { content: jsonMedia(backupExportStatusSchema), description: "Current backup export" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const status = await c.get("services").backupService.getExportStatus(user, auth.acr);
      const payload = serializeBackupExportStatus(status);
      return c.json(payload, 200);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.backup.file,
      responses: {
        200: { description: "Backup ZIP file" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").backupService.downloadCurrentExport(user, auth.acr);
      const headers = {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      };
      if (result.path) {
        return new Response(Bun.file(result.path), { headers });
      }
      return new Response(result.bytes, { headers });
    }
  );

export default backupRoutes;
