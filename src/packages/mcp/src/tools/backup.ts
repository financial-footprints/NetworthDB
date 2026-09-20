import { access, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { bindMethod } from "@mcp/tools/helpers";
import { emptyArgsSchema } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const BACKUP_TOOL_NAMES = [
  "backup_export",
  "backup_import",
  "backup_download",
  "backup_status",
] as const;

const backupExportSchema = z.object({
  password: z.string().min(8),
});

const backupImportSchema = z.object({
  path: z.string().min(1),
  password: z.string().min(8),
});

const backupDownloadSchema = z.object({
  dest_path: z.string().min(1),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.backup.missing-catalog.${name}`);
  }
  return entry;
}

async function assertPathReadable(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(`mcp.backup.path.not_found: ${path}`);
  }
}

export function createBackupTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("backup_export"),
      schema: backupExportSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("POST", API.backup.export, { password: input.password });
      },
    }),
    bindMethod({
      catalog: catalogEntry("backup_import"),
      schema: backupImportSchema,
      invoke: async (input) => {
        requireSession(session);
        await assertPathReadable(input.path);
        const bytes = await readFile(input.path);
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(bytes)]), basename(input.path));
        form.append("password", input.password);
        return session.requestForm(API.backup.import, form);
      },
    }),
    bindMethod({
      catalog: catalogEntry("backup_download"),
      schema: backupDownloadSchema,
      invoke: async (input) => {
        requireSession(session);
        const { buffer, filename } = await session.requestBytes(apiPath(API.backup.file));
        await writeFile(input.dest_path, buffer);
        return {
          path: input.dest_path,
          filename: filename ?? basename(input.dest_path),
          bytes: buffer.byteLength,
        };
      },
    }),
    bindMethod({
      catalog: catalogEntry("backup_status"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return session.requestJson("GET", API.backup.get);
      },
    }),
  ];
}
