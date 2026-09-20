import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { assertAccountNumberWritable } from "@mcp/tools/e2ee";
import { appendQuery, bindMethod, stripUndefined } from "@mcp/tools/helpers";
import { accountIdField, emptyArgsSchema, isoDateField } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { ACCOUNT_LIST_STATUSES, INSTRUMENT_ACCOUNT_TYPES } from "@ndb/core";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const ACCOUNT_TOOL_NAMES = [
  "accounts_list",
  "accounts_get",
  "accounts_create",
  "accounts_patch",
  "accounts_delete",
  "accounts_banks",
  "accounts_system",
  "accounts_metadata",
] as const;

const mailRulesSchema = z
  .object({
    subjects: z.array(z.string()).optional(),
    bodyContains: z.array(z.string()).optional(),
    fromAddresses: z.array(z.string()).optional(),
  })
  .strict()
  .optional()
  .nullable();

const statementRulesSchema = z
  .object({
    textContains: z.array(z.string()).optional(),
    textNotContains: z.array(z.string()).optional(),
  })
  .strict()
  .optional()
  .nullable();

const accountsListSchema = z.object({
  accountType: z.enum(INSTRUMENT_ACCOUNT_TYPES).optional(),
  status: z.enum(ACCOUNT_LIST_STATUSES).optional(),
  q: z.string().min(1).max(200).optional(),
  sort: z.enum(["label", "accountType", "currentBalance"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});

const accountIdSchema = z.object({
  id: accountIdField,
});

const accountsCreateSchema = z.object({
  bank: z.string().min(1),
  variant: z.string().nullable().optional(),
  accountType: z.enum(INSTRUMENT_ACCOUNT_TYPES),
  openingDate: isoDateField,
  closingDate: z.string().nullable().optional(),
  accountNumber: z.string().min(1),
  passwords: z.array(z.string()).optional().default([]),
  mail: mailRulesSchema,
  statement: statementRulesSchema,
});

const accountsPatchSchema = z.object({
  id: z.string().uuid(),
  bank: z.string().min(1).optional(),
  variant: z.string().nullable().optional(),
  accountType: z.enum(INSTRUMENT_ACCOUNT_TYPES).optional(),
  openingDate: z.string().min(1).optional(),
  closingDate: z.string().nullable().optional(),
  accountNumber: z.string().min(1).optional(),
  passwords: z.array(z.string()).optional(),
  mail: mailRulesSchema,
  statement: statementRulesSchema,
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.accounts.missing-catalog.${name}`);
  }
  return entry;
}

export function createAccountTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("accounts_list"),
      schema: accountsListSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(API.accounts.list, {
          accountType: input.accountType,
          status: input.status,
          q: input.q,
          sort: input.sort,
          direction: input.direction,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("accounts_get"),
      schema: accountIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.getJson(apiPath(API.accounts.get, { accountId: input.id }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("accounts_create"),
      schema: accountsCreateSchema,
      invoke: async (input) => {
        requireSession(session);
        await assertAccountNumberWritable(session, input.accountNumber);
        return session.requestJson("POST", API.accounts.create, stripUndefined({ ...input }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("accounts_patch"),
      schema: accountsPatchSchema,
      invoke: async (input) => {
        requireSession(session);
        if (input.accountNumber !== undefined) {
          await assertAccountNumberWritable(session, input.accountNumber);
        }
        const { id, ...fields } = input;
        return session.requestJson(
          "PATCH",
          apiPath(API.accounts.patch, { accountId: id }),
          stripUndefined(fields)
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("accounts_delete"),
      schema: accountIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("DELETE", apiPath(API.accounts.delete, { accountId: input.id }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("accounts_banks"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return session.getJson(API.accounts.banks.get);
      },
    }),
    bindMethod({
      catalog: catalogEntry("accounts_system"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return session.getJson(API.accounts.system.get);
      },
    }),
    bindMethod({
      catalog: catalogEntry("accounts_metadata"),
      schema: accountIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.getJson(apiPath(API.accounts.metadata.get, { accountId: input.id }));
      },
    }),
  ];
}
