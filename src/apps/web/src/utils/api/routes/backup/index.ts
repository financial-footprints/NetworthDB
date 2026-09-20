import { API, backupExportStatusSchema, jobCreatedSchema } from "@ndb/platform";
import { apiRequest, buildUrl } from "@web/utils/api/client";
import { applyRequestAuthHeaders } from "@web/utils/api/helpers";
import { withSessionToken } from "@web/utils/api/routes/auth";
import { invalidateJobs } from "@web/utils/api/routes/jobs";
import type { JobCreatedResponse } from "@web/utils/api/routes/jobs/types";
import type { z } from "zod";

export type BackupExportStatus = z.infer<typeof backupExportStatusSchema>["data"];

export async function startExport(password: string): Promise<JobCreatedResponse> {
  const result = await withSessionToken((sessionToken) =>
    apiRequest(API.backup.export, {
      method: "POST",
      sessionToken,
      body: { password },
      schema: jobCreatedSchema,
    })
  );
  invalidateJobs();
  return result.data;
}

export async function startImport(file: File, password: string): Promise<JobCreatedResponse> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("password", password);
  const result = await withSessionToken((sessionToken) =>
    apiRequest(API.backup.import, {
      method: "POST",
      sessionToken,
      body: formData,
      schema: jobCreatedSchema,
    })
  );
  invalidateJobs();
  return result.data;
}

export async function fetchExportStatus(): Promise<BackupExportStatus> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.backup.get, { sessionToken, schema: backupExportStatusSchema })
  );
  return response.data;
}

export async function downloadExportFile(): Promise<Blob> {
  return withSessionToken(async (sessionToken) => {
    const headers = new Headers();
    applyRequestAuthHeaders(headers, { sessionToken });
    headers.set("X-Request-Id", crypto.randomUUID());
    const response = await fetch(buildUrl(API.backup.file), { headers });
    if (!response.ok) {
      throw new Error(`Failed to download backup (${response.status})`);
    }
    return response.blob();
  });
}
