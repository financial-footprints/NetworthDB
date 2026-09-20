# Account Transaction Rules

User-scoped rule groups and rules that match ledger rows with a when-expression and apply actions (taxonomy, accounts, description, delete).

## Layout

| Path | Contents |
| ---- | -------- |
| `constants.ts` | Limits and catalog type lists |
| `entities/` | `TransactionRuleGroup`, `TransactionRule` |
| `embedded/` | Trigger/action types, parse, `matchWhen`, `applyActions`, `walkRules` |
| `repositories/` | Persistence ports |
| `services/` | `RuleGroupService`, `RuleService`, `RuleEngineService` |

See ADR-009.
