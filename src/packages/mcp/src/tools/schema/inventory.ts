import type { CatalogAccess } from "@mcp/helpers";

export type ServiceCatalogEntry = {
  name: string;
  access: CatalogAccess;
  summary: string;
  relevance: string;
  returns: string;
  instead?: string;
};

export const SERVICE_CATALOG_ENTRIES: ServiceCatalogEntry[] = [
  {
    name: "ping",
    access: "public",
    summary: "Copilot connectivity check.",
    relevance: "Verify the MCP host is running before calling auth or data tools.",
    returns: "{ ok: true }",
  },
  {
    name: "auth_login",
    access: "public",
    summary: "Log in with username and password; optional TOTP or recovery code for MFA.",
    relevance: "Establish an API session before data tools, SQL, or live resources.",
    returns: "{ kind: authenticated } or MFA challenge with multifactor_token and methods.",
  },
  {
    name: "auth_status",
    access: "public",
    summary: "Report whether the host has an authenticated API session.",
    relevance: "Check user id, username, role, and AAL without exposing tokens.",
    returns: "{ authenticated, user } with user null when logged out.",
  },
  {
    name: "schema_describe",
    access: "session",
    summary: "Return queryable database schema (overview, tables, columns, foreign keys, enums).",
    relevance:
      "Required before sql_query (or read ndb://schema). Auth, vault, and sources tables are omitted from SQL.",
    returns: "Schema description JSON (overview, tables, enums).",
  },
  {
    name: "sql_query",
    access: "session",
    summary:
      "Run a single read-only SQL statement (SELECT / WITH / EXPLAIN) as the RO Postgres role.",
    relevance:
      "Cross-table analytics and aggregates after schema_describe. Add LIMIT yourself; max 500 rows returned. Tenant-scoped via RLS.",
    instead:
      "accounts_list, transactions_list, or ndb:// live resources for API pagination, filters, and shaped JSON without SQL.",
    returns: "{ columns, rows, rowCount, truncated }.",
  },
  {
    name: "accounts_list",
    access: "session",
    summary: "List accounts with optional filters and sort.",
    relevance: "Browse bank and instrument accounts with API filters (type, status, search, sort).",
    instead: "sql_query for custom analytics; ndb://accounts for a quick full list mirror.",
    returns: "{ items[], total } account list envelope.",
  },
  {
    name: "accounts_get",
    access: "session",
    summary: "Fetch one account by id.",
    relevance: "Account details including rules and masked fields.",
    returns: "Account JSON.",
  },
  {
    name: "accounts_create",
    access: "session",
    summary: "Create a bank or instrument account (requires bank and account_number).",
    relevance:
      "New account onboarding. Plaintext account_number fails when Account Number E2EE is on; use a sealed blob or disable E2EE in the web UI.",
    returns: "Created account JSON.",
  },
  {
    name: "accounts_patch",
    access: "session",
    summary: "Patch account fields by id.",
    relevance: "Update metadata; account_number changes follow the same E2EE rules as create.",
    returns: "Updated account JSON.",
  },
  {
    name: "accounts_delete",
    access: "session",
    summary: "Delete an account by id.",
    relevance: "Remove an account and related data per API rules.",
    returns: "Empty or null on success.",
  },
  {
    name: "accounts_banks",
    access: "session",
    summary: "List known bank names for account forms.",
    relevance: "Pick a bank label when creating accounts.",
    returns: "Banks list JSON.",
  },
  {
    name: "accounts_system",
    access: "session",
    summary: "List system accounts.",
    relevance: "Internal or system account ids for transfers and rules.",
    returns: "System accounts JSON.",
  },
  {
    name: "accounts_metadata",
    access: "session",
    summary: "Fetch statement metadata for an account.",
    relevance: "See which statement periods exist before sync or download.",
    returns: "Account metadata JSON.",
  },
  {
    name: "statements_sync",
    access: "session",
    summary: "Enqueue statement sync for an account (optional financial year).",
    relevance:
      "Pull statements from configured sources (sources_get / sources_put). Returns a job id — call jobs_wait or jobs_get until complete.",
    returns: "{ id } job envelope.",
  },
  {
    name: "statements_upload",
    access: "session",
    summary: "Upload a statement file from a host path.",
    relevance:
      "Manual statement import from disk on the MCP host. Call jobs_wait after the returned job id.",
    returns: "{ id } job envelope.",
  },
  {
    name: "statements_download",
    access: "session",
    summary: "Download a statement file to a host path.",
    relevance: "Export a stored statement PDF or other format to disk.",
    returns: "{ path, filename, bytes }.",
  },
  {
    name: "statements_mark_synced",
    access: "session",
    summary: "Mark a statement period transactions-sync state.",
    relevance: "Record that transactions were imported for a period.",
    returns: "API response JSON.",
  },
  {
    name: "sources_get",
    access: "session",
    summary: "List email and Thunderbird sources.",
    relevance: "Inspect sync sources before editing.",
    returns: "Sources list JSON.",
  },
  {
    name: "sources_put",
    access: "session",
    summary: "Replace the user's sources configuration.",
    relevance: "Configure IMAP or Thunderbird profiles for statement sync.",
    returns: "Updated sources JSON.",
  },
  {
    name: "transactions_list",
    access: "session",
    summary: "List ledger transactions for an account in a date range.",
    relevance:
      "Paged ledger browse with word search and taxonomy filters. Request/response use camelCase; amounts are rupees × 100.",
    instead:
      "sql_query for analytics across accounts; transactions_summary for totals only without row list.",
    returns: "{ items[], total } transaction list envelope.",
  },
  {
    name: "transactions_create",
    access: "session",
    summary: "Create one transaction on an account.",
    relevance:
      "Single manual ledger entry. Optional categoryId, subcategoryId, tagIds. Amount is positive rupees × 100.",
    instead:
      "transactions_import_create then transactions_batch for many new rows in one import batch.",
    returns: "Created transaction JSON (or null if a rule deleted it).",
  },
  {
    name: "transactions_patch",
    access: "session",
    summary: "Replace all writable fields on one transaction.",
    relevance:
      "Full rewrite of date, amount, sourceAccountId, destinationAccountId, description, refNo, and taxonomy — not a sparse patch.",
    instead: "transactions_bulk when updating many existing rows at once.",
    returns: "Updated transaction JSON.",
  },
  {
    name: "transactions_delete",
    access: "session",
    summary: "Delete a transaction by account and transaction id.",
    relevance: "Remove one ledger row.",
    instead: "transactions_bulk_delete for many ids at once.",
    returns: "Empty or null on success.",
  },
  {
    name: "transactions_batch",
    access: "session",
    summary: "Create many new transactions under one import batch.",
    relevance:
      "Bulk insert only: call transactions_import_create first, then pass importId and items (max MAX_BATCH_SIZE).",
    instead: "transactions_bulk to update existing rows; transactions_create for a single new row.",
    returns: "Created transactions list JSON.",
  },
  {
    name: "transactions_bulk",
    access: "session",
    summary: "Update many existing transactions on an account in one request.",
    relevance:
      "Bulk edit of existing rows (web ledger bulk modal). Each item needs id plus full writable fields (camelCase). Max MAX_BATCH_SIZE.",
    instead: "transactions_batch for new rows under an import; transactions_patch for one row.",
    returns: "{ updated } count JSON.",
  },
  {
    name: "transactions_bulk_delete",
    access: "session",
    summary: "Delete many transactions on an account by id list.",
    relevance: "Bulk delete by transaction uuids (max MAX_BATCH_SIZE).",
    instead: "transactions_delete for a single row.",
    returns: "{ deleted } count JSON.",
  },
  {
    name: "transactions_summary",
    access: "session",
    summary: "Range summary (opening, closing, credits, debits, count).",
    relevance:
      "Account activity totals between from and to dates with the same filters as transactions_list.",
    instead: "sql_query for custom aggregates; transactions_list when you need individual rows.",
    returns: "Range summary JSON (amounts in rupees × 100).",
  },
  {
    name: "transactions_balance",
    access: "session",
    summary: "Account balance as of a calendar date.",
    relevance: "Balance on date on (integer rupees × 100).",
    returns: "{ on, balance }.",
  },
  {
    name: "transactions_import_create",
    access: "session",
    summary: "Create an empty transaction import batch for an account.",
    relevance: "Required before transactions_batch; returns import id.",
    returns: "Import batch JSON with id.",
  },
  {
    name: "transactions_import_delete",
    access: "session",
    summary: "Delete a transaction import batch and its transactions.",
    relevance: "Undo a bulk import by import_id.",
    returns: "Empty or null on success.",
  },
  {
    name: "categories_list",
    access: "session",
    summary: "List categories with optional parent and search.",
    relevance: "Two-level taxonomy: parent_id null for top-level categories.",
    returns: "Paginated category list JSON.",
  },
  {
    name: "categories_create",
    access: "session",
    summary: "Create a category or subcategory.",
    relevance:
      "Set parent_id to a top-level category uuid for a subcategory, or null for top-level.",
    returns: "Created category JSON.",
  },
  {
    name: "categories_patch",
    access: "session",
    summary: "Rename a category by id.",
    relevance: "Name only; structure is fixed at create time.",
    returns: "Updated category JSON.",
  },
  {
    name: "categories_delete",
    access: "session",
    summary: "Delete a category by id.",
    relevance: "Remove category per API rules.",
    returns: "Empty envelope on success.",
  },
  {
    name: "tags_list",
    access: "session",
    summary: "List tags with optional search.",
    relevance: "Flat tag catalog before assigning tag_ids on transactions.",
    returns: "Paginated tag list JSON.",
  },
  {
    name: "tags_create",
    access: "session",
    summary: "Create a tag by name.",
    relevance: "Unique per user (case-insensitive).",
    returns: "Created tag JSON.",
  },
  {
    name: "tags_patch",
    access: "session",
    summary: "Rename a tag by id.",
    relevance: "Update tag label.",
    returns: "Updated tag JSON.",
  },
  {
    name: "tags_delete",
    access: "session",
    summary: "Delete a tag by id.",
    relevance: "Remove tag and assignments per API rules.",
    returns: "Empty envelope on success.",
  },
  {
    name: "rule_groups_list",
    access: "session",
    summary: "List transaction rule groups.",
    relevance: "Browse groups before editing rules or applying a group.",
    returns: "Paginated rule group list JSON.",
  },
  {
    name: "rule_groups_get",
    access: "session",
    summary: "Fetch one rule group by id.",
    relevance: "Group metadata and sort order.",
    returns: "Rule group JSON.",
  },
  {
    name: "rule_groups_create",
    access: "session",
    summary: "Create a rule group.",
    relevance: "New group title and optional description.",
    returns: "Created rule group JSON.",
  },
  {
    name: "rule_groups_patch",
    access: "session",
    summary: "Patch a rule group by id.",
    relevance: "Update title, description, sort_order, or active flag.",
    returns: "Updated rule group JSON.",
  },
  {
    name: "rule_groups_delete",
    access: "session",
    summary: "Delete a rule group by id.",
    relevance: "Remove group per API rules.",
    returns: "Empty envelope on success.",
  },
  {
    name: "rule_groups_apply",
    access: "session",
    summary: "Enqueue apply job for all rules in a group.",
    relevance:
      "Optional date range and taxonomy filters (camelCase); dryRun still enqueues a job. Call jobs_wait, then inspect job output.",
    instead: "rules_test to dry-run one rule against a sample transaction without a job.",
    returns: "{ id } job envelope.",
  },
  {
    name: "rules_list",
    access: "session",
    summary: "List rules in a group.",
    relevance: "Requires group_id. Triggers and actions are JSON catalog items.",
    returns: "Paginated rule list JSON.",
  },
  {
    name: "rules_get",
    access: "session",
    summary: "Fetch one rule by id.",
    relevance: "Full trigger and action JSON.",
    returns: "Rule JSON.",
  },
  {
    name: "rules_create",
    access: "session",
    summary: "Create a rule in a group.",
    relevance:
      "Pass when as an and/or expression of { type, ... } trigger leaves, plus actions. Amounts in test/apply contexts are rupees × 100.",
    returns: "Created rule JSON.",
  },
  {
    name: "rules_patch",
    access: "session",
    summary: "Patch a rule by id.",
    relevance: "Update metadata, when, or actions.",
    returns: "Updated rule JSON.",
  },
  {
    name: "rules_delete",
    access: "session",
    summary: "Delete a rule by id.",
    relevance: "Remove rule from group.",
    returns: "Empty envelope on success.",
  },
  {
    name: "rules_test",
    access: "session",
    summary: "Dry-run a rule against a sample transaction (synchronous).",
    relevance:
      "Pass sample transaction fields in camelCase (amount rupees × 100). Immediate matched/actions/warnings — no job.",
    instead: "rules_apply or rule_groups_apply to run against real ledger rows (async job).",
    returns: "{ matched, actions, warnings }.",
  },
  {
    name: "rules_apply",
    access: "session",
    summary: "Enqueue apply job for one rule.",
    relevance: "Optional filters and dryRun (camelCase). Call jobs_wait after the returned job id.",
    instead: "rules_test for a one-off synthetic sample without enqueueing a job.",
    returns: "{ id } job envelope.",
  },
  {
    name: "jobs_list",
    access: "session",
    summary: "List background jobs for the current user.",
    relevance: "Upload, sync, backup, and rules_apply stages.",
    returns: "Paginated job list JSON.",
  },
  {
    name: "jobs_get",
    access: "session",
    summary: "Fetch job details by id.",
    relevance: "Status, stage, output, and error.",
    returns: "Job JSON.",
  },
  {
    name: "jobs_cancel",
    access: "session",
    summary: "Cancel queued or running jobs.",
    relevance: "Optional id query to cancel one job.",
    returns: "{ cancelled_ids }.",
  },
  {
    name: "jobs_wait",
    access: "session",
    summary: "Poll until a job leaves queued/running.",
    relevance:
      "Call after statements_sync, statements_upload, backup_export, backup_import, rules_apply, or rule_groups_apply. Default timeout 10 minutes.",
    instead: "jobs_get for a single status check without blocking.",
    returns: "Final job JSON (status, stage, output when complete).",
  },
  {
    name: "backup_export",
    access: "session",
    summary: "Start backup export job.",
    relevance:
      "ZIP password required (min 8 chars). Then jobs_wait or backup_status; fetch file with backup_download.",
    returns: "{ id } job envelope.",
  },
  {
    name: "backup_import",
    access: "session",
    summary: "Import backup ZIP from a host path.",
    relevance:
      "Password required. Returns job id — call jobs_wait. Replaces destination vault data.",
    returns: "{ id } job envelope.",
  },
  {
    name: "backup_download",
    access: "session",
    summary: "Download the current ready export ZIP to a host path.",
    relevance: "Uses the user's single current 7-day export — no job id parameter.",
    instead: "backup_export and jobs_wait when no ready export exists yet.",
    returns: "{ path, filename, bytes }.",
  },
  {
    name: "backup_status",
    access: "session",
    summary: "Current backup export metadata.",
    relevance: "Shows ready file filename/expiry and active export job id.",
    returns: "{ current, active_job_id }.",
  },
  {
    name: "profile_get",
    access: "session",
    summary: "Fetch the signed-in user's profile.",
    relevance: "displayName, clientSettings, MFA flags — not vault unlock or other users.",
    instead: "users_admin_list only for manager/administrator listing other users.",
    returns: "Me details JSON.",
  },
  {
    name: "profile_patch",
    access: "session",
    summary: "Patch the signed-in user's profile.",
    relevance:
      "Username, password, displayName, clientSettings, recoveryEmail (camelCase). Plaintext displayName fails when Display Name E2EE is on.",
    instead: "users_admin_patch to change another user's username or role.",
    returns: "Session tokens or empty per API.",
  },
  {
    name: "users_admin_list",
    access: "session",
    summary: "List users (manager or administrator).",
    relevance:
      "Tenant user administration. MCP rejects role user before the API. Pagination and filters available.",
    instead: "profile_get for the current user only.",
    returns: "{ items[], total } user list envelope.",
  },
  {
    name: "users_admin_create",
    access: "session",
    summary: "Create a user (administrator).",
    relevance: "Requires elevated role; API enforces administrator + AAL2.",
    returns: "Created user JSON.",
  },
  {
    name: "users_admin_patch",
    access: "session",
    summary: "Patch a user by id (administrator).",
    relevance: "Username or role changes.",
    returns: "Updated user JSON.",
  },
  {
    name: "users_admin_delete",
    access: "session",
    summary: "Delete a user by id (administrator).",
    relevance: "Destructive; API enforces administrator.",
    returns: "Empty envelope on success.",
  },
  {
    name: "credit_cards_catalog_list",
    access: "session",
    summary: "List credit card benefit catalog metadata.",
    relevance:
      "Index of issuer cards (optional tag filter). Reference data from HTTP API — not in SQL.",
    instead:
      "credit_cards_catalog_get for one bank/variant; credit_cards_catalog_bulk for all catalogs at once.",
    returns: "{ items, total } catalog metadata per card.",
  },
  {
    name: "credit_cards_catalog_get",
    access: "session",
    summary: "Fetch the full benefit catalog for one bank and variant.",
    relevance: "bank and variant keys match statement handlers (e.g. idfc, wow).",
    instead: "credit_cards_catalog_bulk for the full comparison matrix.",
    returns: "{ data } full catalog JSON with benefit slots.",
  },
  {
    name: "credit_cards_catalog_bulk",
    access: "session",
    summary: "Fetch full benefit catalogs for all cards (comparison matrix).",
    relevance:
      "All issuer catalogs in one response for card comparison. Not available via sql_query.",
    instead: "credit_cards_catalog_get for a single bank/variant.",
    returns: "Bulk catalog JSON keyed by bank/variant.",
  },
  {
    name: "credit_cards_benefits_get",
    access: "session",
    summary: "Benefit-first view: all cards for one catalog slot path.",
    relevance:
      "slotId is a flattened path such as lounge.domestic or welcome — which cards include that benefit.",
    instead: "credit_cards_catalog_get for the full slot tree of one card.",
    returns: "{ data: { slot_id, items[] } } per-card status and summary.",
  },
];

export const SERVICE_CATALOG_BY_NAME = new Map(
  SERVICE_CATALOG_ENTRIES.map((entry) => [entry.name, entry])
);
