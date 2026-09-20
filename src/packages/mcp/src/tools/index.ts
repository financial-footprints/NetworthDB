import { ACCOUNT_TOOL_NAMES } from "@mcp/tools/accounts";
import { ADMIN_TOOL_NAMES } from "@mcp/tools/admin";
import { BACKUP_TOOL_NAMES } from "@mcp/tools/backup";
import { CATEGORY_TOOL_NAMES } from "@mcp/tools/categories";
import { CREDIT_CARD_TOOL_NAMES } from "@mcp/tools/credit-cards";
import { JOB_TOOL_NAMES } from "@mcp/tools/jobs";
import { PROFILE_TOOL_NAMES } from "@mcp/tools/profile";
import { RULE_GROUP_TOOL_NAMES } from "@mcp/tools/rule-groups";
import { RULE_TOOL_NAMES } from "@mcp/tools/rules";
import { SOURCE_TOOL_NAMES } from "@mcp/tools/sources";
import { STATEMENT_TOOL_NAMES } from "@mcp/tools/statements";
import { TAG_TOOL_NAMES } from "@mcp/tools/tags";
import { TRANSACTION_TOOL_NAMES } from "@mcp/tools/transactions";

export const DOMAIN_TOOL_NAMES = [
  ...ACCOUNT_TOOL_NAMES,
  ...STATEMENT_TOOL_NAMES,
  ...SOURCE_TOOL_NAMES,
  ...TRANSACTION_TOOL_NAMES,
  ...CATEGORY_TOOL_NAMES,
  ...CREDIT_CARD_TOOL_NAMES,
  ...TAG_TOOL_NAMES,
  ...RULE_GROUP_TOOL_NAMES,
  ...RULE_TOOL_NAMES,
  ...JOB_TOOL_NAMES,
  ...BACKUP_TOOL_NAMES,
  ...PROFILE_TOOL_NAMES,
  ...ADMIN_TOOL_NAMES,
] as const;
