# Account Dashboard

Read-model snapshot for a date range: net worth, cashflow, category and account breakdowns, and trend series.

## Layout

| Path | Contents |
| ---- | -------- |
| `services/dashboard-service.ts` | Range query and snapshot assembly |
| `repositories/dashboard-repository.ts` | SQL aggregates port |
| `helpers.ts` | Sort helpers for named/account amount lists |
| `types.ts` | `DashboardSnapshot`, series points, cashflow/net-worth shapes |

## Dependencies

- `DashboardService` reads ledger and account data through `DashboardRepository` (Drizzle in `@ndb/database`).
- Active period filtering is applied at the API layer; core accepts explicit `from` / `to` ISO dates.
