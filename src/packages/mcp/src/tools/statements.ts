import { access, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod } from "@mcp/tools/helpers";
import { accountIdField } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const STATEMENT_TOOL_NAMES = [
  "statements_sync",
  "statements_upload",
  "statements_download",
  "statements_mark_synced",
] as const;

const statementsSyncSchema = z.object({
  accountId: accountIdField,
  financialYear: z.string().optional().describe("Optional financial year key for scoped sync."),
});

const statementsUploadSchema = z.object({
  path: z.string().min(1),
  account_id: z.string().uuid(),
  format: z.string().min(1),
  statement_kind: z.string().optional(),
  covered_month: z.string().optional(),
  year_key: z.string().optional(),
});

const statementsDownloadSchema = z.object({
  id: z.string().uuid(),
  statement_date: z.string().min(1),
  format: z.string().min(1),
  dest_path: z.string().min(1),
});

const statementsMarkSyncedSchema = z.object({
  id: z.string().uuid(),
  period: z.string().min(1),
  transactions_synced: z.boolean(),
  transactions_import_id: z.string().uuid().nullable(),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.statements.missing-catalog.${name}`);
  }
  return entry;
}

async function assertPathReadable(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(`mcp.statements.path.not_found: ${path}`);
  }
}

export function createStatementTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("statements_sync"),
      schema: statementsSyncSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("POST", API.accounts.statements.sync, {
          accountId: input.accountId,
          financialYear: input.financialYear,
        });
      },
    }),
    bindMethod({
      catalog: catalogEntry("statements_upload"),
      schema: statementsUploadSchema,
      invoke: async (input) => {
        requireSession(session);
        await assertPathReadable(input.path);
        const bytes = await readFile(input.path);
        const form = new FormData();
        form.append("account_id", input.account_id);
        form.append("format", input.format);
        form.append("file", new Blob([bytes]), basename(input.path));
        if (input.statement_kind !== undefined) {
          form.append("statement_kind", input.statement_kind);
        }
        if (input.covered_month !== undefined) {
          form.append("covered_month", input.covered_month);
        }
        if (input.year_key !== undefined) {
          form.append("year_key", input.year_key);
        }
        return session.requestForm(API.accounts.files.upload, form);
      },
    }),
    bindMethod({
      catalog: catalogEntry("statements_download"),
      schema: statementsDownloadSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(apiPath(API.accounts.files.download, { accountId: input.id }), {
          statement_date: input.statement_date,
          format: input.format,
        });
        const { buffer, filename } = await session.requestBytes(path);
        await writeFile(input.dest_path, buffer);
        return {
          path: input.dest_path,
          filename: filename ?? basename(input.dest_path),
          bytes: buffer.byteLength,
        };
      },
    }),
    bindMethod({
      catalog: catalogEntry("statements_mark_synced"),
      schema: statementsMarkSyncedSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...body } = input;
        return session.requestJson(
          "POST",
          apiPath(API.accounts.statements.transactionsSync, { accountId: id }),
          body
        );
      },
    }),
  ];
}
