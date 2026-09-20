export const DOCS_LEDGER_MARKDOWN = `# Ledger (ADR-006)

Each \`transactions\` row moves a **positive** \`amount\` from \`source_account_id\` to \`destination_account_id\` on a calendar \`date\` string. Description and \`ref_no\` are plaintext (searchable).

- **Imports** — \`transaction_imports\` batch headers; facts link via \`import_id\`; delete import cascades facts.
- **Monthly summaries** — \`transactions_monthly_summary\` stores per-account credits, debits, opening/closing per month for fast balance-as-of queries.
- **Taxonomy** — optional \`category_id\`, \`subcategory_id\`; tags via \`transaction_tag_assignments\`.

Instrument accounts: bank, credit_card, loan, stocks, bonds, mutual_funds. Statement sync applies to bank and credit_card only.

## MCP ledger writes

| Scenario | Tools |
| -------- | ----- |
| One new row | \`transactions_create\` |
| Many new rows in an import batch | \`transactions_import_create\` then \`transactions_batch\` |
| Update many existing rows | \`transactions_bulk\` (each item: \`id\` + full writable fields) |
| Update one row | \`transactions_patch\` |
| Delete many rows | \`transactions_bulk_delete\` |
| Delete one row | \`transactions_delete\` |

Request bodies use **camelCase**. Amounts are rupees × 100.
`;
