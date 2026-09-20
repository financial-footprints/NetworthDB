import { RULE_ACTION_TYPES, RULE_TRIGGER_TYPES } from "@ndb/core";

export const DOCS_RULES_MARKDOWN = `# Transaction rules (ADR-009)

Rules live in **groups** (\`transaction_rule_groups\`) with ordered **rules** (\`transaction_rules\`). Each rule has a **when** expression (\`and\` / \`or\` groups, or one trigger leaf), **actions**, \`stop_processing\`, and \`run_on_create\`.

## Trigger types

${RULE_TRIGGER_TYPES.map((type) => `- \`${type}\``).join("\n")}

## Action types

${RULE_ACTION_TYPES.map((type) => `- \`${type}\``).join("\n")}

Manual apply runs a \`rules_apply\` job. MCP mutation tools for rules arrive in a later phase.
`;
