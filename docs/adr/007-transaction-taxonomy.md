# ADR-007: Transaction Taxonomy (Categories and Tags)

## Status

Accepted

## Context

Users classify ledger movements for reporting and filtering. They need a stable per-user catalog of categories (with optional subcategories) and free-form tags, without coupling classification to statement ingest or account metadata.

## Decision

### Category tree

- **Two levels only** — A root row is a category (`parent_id` null). A child row is a subcategory whose parent must be a root. No deeper nesting.
- **Per transaction** — At most one category and at most one subcategory. Both are optional (uncategorized). If a subcategory is set, the category must be set and must be that subcategory’s parent.
- **Per user** — All category rows are scoped to one user. Names are unique case-insensitively: roots unique per user; children unique per user and parent.

### Tags

- **Flat catalog** — Tags have no hierarchy.
- **Many-to-many** — A transaction may have zero or more tags, capped at twenty per row. Duplicate tag ids in one write are deduped.
- **Per user** — Tag names are unique case-insensitively per user.

### Encryption

- Category and tag **names** are tier 3 plaintext (same justification as account labels): list, filter, and enforce uniqueness without vault unlock.

### Lifecycle

- **Seed if empty** — New users receive a small default category tree (editable and deletable). Tags are not seeded.
- **Updates** — Rename only; no reparenting categories or moving subcategories between parents.
- **Delete category** — Subcategories cascade-delete. Transaction `category_id` and `subcategory_id` are cleared (SET NULL); transactions are not deleted.
- **Delete tag** — Assignment rows are removed; transactions remain.

### Ingest

- Statement import creates ledger rows with no category, subcategory, or tags. **Transaction rules** may set taxonomy on create when configured; otherwise users assign taxonomy in the ledger UI.

### Backup

- Export and import include category and tag catalogs and transaction assignments (category, subcategory, and tags on each fact row).

## Alternatives Considered

| Alternative | Why rejected |
| ----------- | ------------ |
| E2E category/tag names | Blocks server-side list and unique constraints without unlock |
| Single “category” string on the transaction | No shared catalog or subcategory structure |
| Tags as JSON column on transactions | Harder to filter by tag at scale; join table is clearer |
| Seed tags by default | User asked for editable category seed only; tags start empty |

## Consequences

### Positive

- Clear model for one primary classification path (category + optional subcategory) plus flexible tags.
- Filters on ledger lists by category or tag without decrypting descriptions.

### Negative

- Taxonomy validation on every transaction write (ownership and parent-child rules).
- Deleting a category clears classifications on affected rows (by design).

## References

- [ADR-004](004-data-encryption-policy.md) — tier classification
- [ADR-006](006-transactions-ledger.md) — ledger facts and ingest
- [ADR-009](009-transaction-rules-engine.md) — rules may set category and tags
