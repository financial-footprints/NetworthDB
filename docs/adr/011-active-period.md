# ADR-011: Active Period Preference

## Status

Accepted

## Context

Users need a single reporting window for networth views: transactions today, and future dashboards and summaries. Date ranges must survive logout and login. Transaction list, summary, and dashboard APIs accept an optional bounded range (`from` and `to` together) or omit both for all dates (ADR-006); the server does not read `client_settings.active_period`.

## Decision

- Store the **active period** in `users.client_settings` as tier-3 client JSON (ADR-004). The server persists but does not interpret the shape.
- The web app resolves presets in the browser using the local calendar. Default when unset: **Everything** (omit `from`/`to` on APIs so SQL has no date filter on facts).
- **Presets** (`everything`, `today`, `this_week`, `this_month`, `previous_month`, `this_year`, `this_financial_year`) are stored by id only so they stay current after reload.
- **Custom** ranges store ISO `YYYY-MM-DD` `from` and `to`.
- Features that honor the active period read a shared React context; bounded presets pass `from`/`to` to APIs; **Everything** omits those query params. Live “as of today” balances on account tiles remain independent of the active period.

## Consequences

### Positive

- One preference drives multiple features without new database columns.
- Backup and restore already include `client_settings` (ADR-008).
- Bounded calls stay explicit about date bounds; all-dates calls omit bounds instead of sentinel dates.

### Negative

- Preset boundaries (e.g. week start) follow client local time; there is no per-user timezone setting yet.

### Neutral

- MCP and server jobs do not read active period unless extended later.

## Alternatives Considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Dedicated `users` column | Unnecessary for client-owned UI state; duplicates `client_settings` pattern |
| Server-side default `from`/`to` on list APIs | Hides whether the client wants all dates vs a bounded window |
| `localStorage` only | Does not survive logout or multi-device use |

## References

- ADR-004 (data encryption policy)
- ADR-006 (transactions ledger)
- ADR-008 (backup archive)
