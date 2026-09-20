# Schema Column Order

Drizzle preserves the key order of each `pgTable` object in generated SQL. PostgreSQL pads fixed-width column types to alignment boundaries, so mixing widths in arbitrary order wastes row space.

Within each `pgTable` object, list columns in this order:

1. **8-byte**: `timestamp`, `bigint`, `doublePrecision`, …
2. **4-byte**: `integer`, `real`, `date`, `pgEnum`, …
3. **16-byte**: `uuid`
4. **1-byte**: `boolean`
5. **Variable-length last**: `text`, `varchar`, `bytea`, `json`, `jsonb`, …

When adding, removing, or reordering columns, **re-sort the whole column list** — do not append new columns at the end if that breaks alignment.

Examples in this package:

- [accounts.ts](accounts.ts) — timestamps and `date` first, then enum and uuid, then text and `bytea`
- [users/index.ts](users/index.ts) — same pattern for the users table

Do not hand-edit SQL under `src/packages/database/drizzle/migrations/` to fix alignment; change schema files and run `make migrations name=<name>`.
