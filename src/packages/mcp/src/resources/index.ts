import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import { RESOURCE_CATALOG_BY_NAME } from "@mcp/resources/catalog";
import { DOCS_HOWTO_MARKDOWN } from "@mcp/resources/docs/howto";
import { DOCS_JOBS_MARKDOWN } from "@mcp/resources/docs/jobs";
import { DOCS_LEDGER_MARKDOWN } from "@mcp/resources/docs/ledger";
import { DOCS_RULES_MARKDOWN } from "@mcp/resources/docs/rules";
import { DOCS_TAXONOMY_MARKDOWN } from "@mcp/resources/docs/taxonomy";
import type { McpResourceDefinition, ResourceCompleteCallback } from "@mcp/resources/helpers";
import type { ReadonlySqlExecutor } from "@ndb/database/readonly";
import { API, apiPath } from "@ndb/platform";

export type CreateMcpResourcesOptions = {
  session: SessionStore;
  sql?: ReadonlySqlExecutor;
};

function requireCatalog(name: string) {
  const entry = RESOURCE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.resources.catalog-entry.missing.${name}`);
  }
  return entry;
}

function definition(
  name: string,
  read: McpResourceDefinition["read"],
  complete?: Record<string, ResourceCompleteCallback>
): McpResourceDefinition {
  const entry = requireCatalog(name);
  return {
    name: entry.name,
    uri: entry.uri,
    uriTemplate: entry.uriTemplate,
    title: entry.title,
    description: entry.description,
    mimeType: entry.mimeType,
    complete,
    read,
  };
}

export function createMcpResources(options: CreateMcpResourcesOptions): McpResourceDefinition[] {
  const { session, sql } = options;
  const resources: McpResourceDefinition[] = [
    definition("docs_howto", async () => DOCS_HOWTO_MARKDOWN),
    definition("docs_ledger", async () => DOCS_LEDGER_MARKDOWN),
    definition("docs_taxonomy", async () => DOCS_TAXONOMY_MARKDOWN),
    definition("docs_rules", async () => DOCS_RULES_MARKDOWN),
    definition("docs_jobs", async () => DOCS_JOBS_MARKDOWN),
    definition("me", async () => {
      requireSession(session);
      return session.getJson(API.users.me.get);
    }),
    definition("accounts", async () => {
      requireSession(session);
      return session.getJson(API.accounts.list);
    }),
    definition("account", async (_uri, params) => {
      requireSession(session);
      const id = params.id ?? "";
      return session.getJson(apiPath(API.accounts.get, { accountId: id }));
    }),
    definition("categories", async () => {
      requireSession(session);
      return session.getJson(API.categories.list);
    }),
    definition("tags", async () => {
      requireSession(session);
      return session.getJson(API.tags.list);
    }),
    definition("rule_groups", async () => {
      requireSession(session);
      return session.getJson(API.ruleGroups.list);
    }),
    definition("system_accounts", async () => {
      requireSession(session);
      return session.getJson(API.accounts.system.get);
    }),
  ];

  if (sql) {
    const completeTable: ResourceCompleteCallback = async (value) => {
      requireSession(session);
      const schema = sql.describeSchema();
      const names = schema.tables.map((table) => table.name);
      const needle = value.toLowerCase();
      return names.filter((name) => name.toLowerCase().includes(needle)).slice(0, 20);
    };

    resources.push(
      definition("schema", async () => {
        requireSession(session);
        return sql.describeSchema();
      }),
      definition(
        "schema_table",
        async (_uri, params) => {
          requireSession(session);
          const tableName = params.table ?? "";
          const schema = sql.describeSchema();
          const table = schema.tables.find((entry) => entry.name === tableName);
          if (!table) {
            throw new Error(`mcp.resources.schema.unknown-table.${tableName}`);
          }
          return table;
        },
        { table: completeTable }
      )
    );
  }

  return resources;
}
