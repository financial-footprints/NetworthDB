import { PROMPT_PREAMBLE } from "@mcp/prompts/instructions/shared";

export const MONTHLY_REVIEW_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Monthly review for the given date range (and optional account_id). Summarize credits, debits, notable merchants, uncategorized spend, and month-over-month changes using SQL.`;

export const SPENDING_BY_CATEGORY_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Spending by category between \`from\` and \`to\`. Join transactions to categories; exclude pure transfers via system accounts when appropriate.`;

export const UNCATEGORIZED_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: List uncategorized transactions (null category_id) in the date range with amounts and descriptions.`;

export const CASHFLOW_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Cashflow between \`from\` and \`to\` — classify movements through revenue/expense system accounts vs instrument accounts.`;

export const EXPLAIN_BALANCE_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Explain \`account_id\` balance as of \`date\` using monthly summaries plus partial-month facts if needed.`;

export const ACCOUNT_COVERAGE_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Account coverage — which accounts exist, optional focus on \`account_id\`, and whether recent transactions exist. Use \`ndb://accounts\` and SQL.`;

export const DRAFT_RULE_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Draft a transaction rule from the example text. Output proposed trigger JSON and action JSON matching ADR-009 types. Do not persist — rule MCP tools arrive later.`;

export const RULE_APPLY_DRY_RUN_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Dry-run plan for applying \`rule_id\` or \`group_id\` with optional filters. Explain which transactions would match and what actions would run. Do not enqueue jobs yet.`;

export const DUPLICATE_SCAN_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Scan for duplicate or near-duplicate transactions (same amount, date, similar description) in the optional account and date range.`;

export const NET_WORTH_SNAPSHOT_INSTRUCTION = `${PROMPT_PREAMBLE}

Task: Net worth snapshot as of \`as_of\` using account balances; document assumptions and SQL used.`;
