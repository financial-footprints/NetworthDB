import { accounts, accountsSchemaDoc, accountTypeEnum } from "@database/schema/accounts";
import { backupExports, backupExportsSchemaDoc } from "@database/schema/backup-exports";
import { jobStageEnum, jobStatusEnum, jobs, jobsSchemaDoc } from "@database/schema/jobs";
import {
  transactionCategories,
  transactionCategoriesSchemaDoc,
} from "@database/schema/transactions/categories";
import {
  transactionImports,
  transactionImportsSchemaDoc,
} from "@database/schema/transactions/imports";
import {
  transactionsMonthlySummary,
  transactionsMonthlySummarySchemaDoc,
} from "@database/schema/transactions/monthly-summary";
import {
  transactionRuleGroups,
  transactionRuleGroupsSchemaDoc,
} from "@database/schema/transactions/rule-groups";
import { transactionRules, transactionRulesSchemaDoc } from "@database/schema/transactions/rules";
import {
  transactionTagAssignments,
  transactionTagAssignmentsSchemaDoc,
  transactionTags,
  transactionTagsSchemaDoc,
} from "@database/schema/transactions/tags";
import { transactions, transactionsSchemaDoc } from "@database/schema/transactions/transactions";
import { userRoleEnum, users, usersSchemaDoc } from "@database/schema/users/index";
import type { Table } from "drizzle-orm";

export type SchemaTableDoc = {
  summary: string;
  notes?: string[];
  columnEnums?: Record<string, readonly string[]>;
  omittedColumns?: Array<{ name: string; reason: string }>;
  jsonShapes?: Record<string, string>;
};

export const SCHEMA_OVERVIEW = [
  "NetworthDB stores users, financial accounts, ledger transactions, taxonomy, rules, and job metadata.",
  "Amounts on transactions and monthly summaries are integer rupees times 100 (bigint).",
  "Each user has four system accounts: unknown, revenue, expense, tumbler.",
  "display_name and account_number may be E2EE opaque strings when toggles are on in client_settings.",
  "Read-only SQL is tenant-scoped via SET LOCAL app.user_id and RLS; call schema_describe before sql_query.",
  "Auth, vault, and sources tables are not exposed to MCP SQL.",
].join(" ");

export const SCHEMA_TABLES: Array<{ table: Table; doc: SchemaTableDoc }> = [
  { table: users, doc: usersSchemaDoc },
  { table: accounts, doc: accountsSchemaDoc },
  { table: jobs, doc: jobsSchemaDoc },
  { table: backupExports, doc: backupExportsSchemaDoc },
  { table: transactions, doc: transactionsSchemaDoc },
  { table: transactionImports, doc: transactionImportsSchemaDoc },
  { table: transactionsMonthlySummary, doc: transactionsMonthlySummarySchemaDoc },
  { table: transactionCategories, doc: transactionCategoriesSchemaDoc },
  { table: transactionTags, doc: transactionTagsSchemaDoc },
  { table: transactionTagAssignments, doc: transactionTagAssignmentsSchemaDoc },
  { table: transactionRuleGroups, doc: transactionRuleGroupsSchemaDoc },
  { table: transactionRules, doc: transactionRulesSchemaDoc },
];

export const SCHEMA_ENUMS = [userRoleEnum, accountTypeEnum, jobStageEnum, jobStatusEnum];
