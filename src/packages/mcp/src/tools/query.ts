import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { createAccountTools } from "@mcp/tools/accounts";
import { createAdminTools } from "@mcp/tools/admin";
import { createAuthTools } from "@mcp/tools/auth";
import { createBackupTools } from "@mcp/tools/backup";
import { createCategoryTools } from "@mcp/tools/categories";
import { createCreditCardTools } from "@mcp/tools/credit-cards";
import { createJobTools } from "@mcp/tools/jobs";
import { createProfileTools } from "@mcp/tools/profile";
import { createRuleGroupTools } from "@mcp/tools/rule-groups";
import { createRuleTools } from "@mcp/tools/rules";
import { createSourceTools } from "@mcp/tools/sources";
import { createSqlTools } from "@mcp/tools/sql";
import { createStatementTools } from "@mcp/tools/statements";
import { createTagTools } from "@mcp/tools/tags";
import { createTransactionTools } from "@mcp/tools/transactions";
import type { ReadonlySqlExecutor } from "@ndb/database/readonly";

export function assembleMcpTools(options: {
  session: SessionStore;
  sql?: ReadonlySqlExecutor;
}): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [...createAuthTools(options.session)];

  if (options.sql) {
    tools.push(...createSqlTools({ session: options.session, sql: options.sql }));
  }

  tools.push(
    ...createAccountTools(options.session),
    ...createStatementTools(options.session),
    ...createSourceTools(options.session),
    ...createTransactionTools(options.session),
    ...createCategoryTools(options.session),
    ...createCreditCardTools(options.session),
    ...createTagTools(options.session),
    ...createRuleGroupTools(options.session),
    ...createRuleTools(options.session),
    ...createJobTools(options.session),
    ...createBackupTools(options.session),
    ...createProfileTools(options.session),
    ...createAdminTools(options.session)
  );

  return tools;
}
