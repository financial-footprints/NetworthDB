# ADR-012: Dashboard Insights

## Status

Accepted

## Context

Users need a household-level view of cashflow, spending by category, and net worth over a reporting window. The ledger already stores plaintext amounts and taxonomy (ADR-004, ADR-006, ADR-007). A single global date preference drives transaction lists and should drive the home dashboard without the server interpreting that preference (ADR-011). Account list tiles remain “as of today” balances.

## Decision

- Expose a **household dashboard snapshot** for an optional calendar `from` and `to` supplied by the client on each request (both omitted = all ledger dates). The API does not read `client_settings.active_period`. Responses echo an **effective** `from`/`to` (min transaction date through today when unbounded) for charts and net worth.
- **Aggregate on the server** (SUM and GROUP BY). Amounts and category names are tier-3 plaintext; no vault unlock is required for dashboard totals.
- Classify each transaction row by account types on source and destination:
  - **Spend:** instrument → `unknown`, `expense`, or `tumbler`.
  - **Income:** `unknown`, `revenue`, or `tumbler` → instrument.
  - **Transfer:** instrument → instrument (excluded from spend and income).
- **Unknown** system account counterparts count as spend (outflow) or income (inflow) so statement ingest is visible before users reclassify to Revenue or Expense. Surface totals still tied to Unknown separately for hygiene.
- Taxonomy category names (e.g. “Income”, “Transfers”) do not define cashflow; system account types do.
- **Net worth** on the dashboard is the sum of instrument balances as-of the day before `from` (opening) and as-of `to` (closing), not the account tile’s latest monthly closing independent of the period.

## Consequences

### Positive

- One request powers the home page for arbitrary date ranges, including multi-year custom periods.
- Consistent rules with the ledger pair model and MCP-style analytics prompts.
- Active period stays client-owned while APIs remain explicit about bounds.

### Negative

- Dashboard SQL is separate from per-account summary endpoints; must stay aligned when pair rules change.

### Neutral

- PDF export, MCP dashboard tools, and tag-level charts are out of scope until requested.

## Alternatives Considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Client fan-out of per-account `transactions/summary` | Too many round trips; no cross-account category rollup |
| Rolling 90 / 180 / 365-day presets only (Argus-style) | Conflicts with ADR-011 arbitrary active period |
| Server default `from`/`to` from `client_settings` | Server would interpret client UI state; ADR-011 keeps bounds explicit on each API call |

## References

- ADR-004 (data encryption policy)
- ADR-006 (transactions ledger)
- ADR-007 (transaction taxonomy)
- ADR-011 (active period preference)
