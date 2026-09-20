export const DOCS_HOWTO_MARKDOWN = `# NetworthDB MCP how-to

## Authentication

Use \`auth_login\` with username and password (optional TOTP or recovery code for MFA). Check \`auth_status\` for user id, role, and AAL. The API enforces AAL2 on sensitive writes when MFA is enabled.

## Choosing a tool

| Goal | Tool |
| ---- | ---- |
| Custom analytics / aggregates | \`schema_describe\` then \`sql_query\` (read-only, tenant RLS) |
| Paged lists and API filters | \`accounts_list\`, \`transactions_list\`, \`categories_list\`, etc. |
| Quick JSON mirrors of GET | \`ndb://accounts\`, \`ndb://categories\`, \`ndb://me\`, … |
| One new ledger row | \`transactions_create\` |
| Many new rows (import) | \`transactions_import_create\` → \`transactions_batch\` |
| Edit many existing rows | \`transactions_bulk\` |
| Delete many rows | \`transactions_bulk_delete\` |
| Credit card catalogs | \`credit_cards_catalog_*\` (not SQL) |
| Async work (sync, backup, rules) | enqueue tool → \`jobs_wait\` |

Each MCP tool description includes **Auth**, **Use when**, optional **Prefer instead**, and **Returns**.

## Tools vs SQL

- **Mutations** — named MCP tools only; same rules as the web UI.
- **Credit cards** — \`credit_cards_*\` hits reference HTTP APIs; catalogs are not in Postgres for MCP SQL.
- **Analytics** — \`schema_describe\` (or \`ndb://schema\`) before \`sql_query\`.

## Amounts

Ledger \`amount\` and monthly summary columns are **integer rupees × 100** (bigint). There are no credit/debit columns on transaction facts.

## System accounts

Each user has four hidden accounts: **unknown**, **revenue**, **expense**, **tumbler**. Statement import defaults to unknown as the counterpart.

## E2EE pass-through

\`display_name\` and \`account_number\` may be opaque \`{nonce}.{ciphertext}\` when E2EE toggles are on. MCP does not decrypt. Do not invent ciphertext on writes.

## Jobs

Async API work returns a job id. Call \`jobs_wait\` (or \`jobs_get\` for a single check) until completed or failed. See \`ndb://docs/jobs\`.
`;
