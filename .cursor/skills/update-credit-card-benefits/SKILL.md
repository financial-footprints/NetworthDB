---
name: update-credit-card-benefits
description: Refresh or add credit card benefit catalogs under src/packages/platform/data/credit-cards from issuer sources. Use when updating research.md or catalog.json, adding a handler variant, or running a quarterly benefits review.
paths:
  - "src/packages/platform/data/credit-cards/**"
  - "src/packages/platform/src/cards/**"
  - "src/packages/statements/src/banks/handlers/registry.ts"
  - "src/packages/statements/src/cards/**"
---

# Update Credit Card Benefits

Human-edited reference data for [`src/packages/platform/data/credit-cards/`](../../../src/packages/platform/data/credit-cards/). Catalogs ship with `@ndb/platform`, are validated by Zod, and exposed only through the HTTP API (ADR-013). Do not wire catalogs into the statement pipeline.

## When to Use

- Refresh MITC or product-page facts for one variant or a batch.
- Add a catalog for a new `listHandlers()` key.
- Fix conflicts, `unknown` slots, or `default_kind` classification on `default` variants.

## Inputs

| Input | Meaning |
| ----- | ------- |
| `bank/variant` | Single registry key (folder path and `registry_key` must match). |
| `--all` | Refresh every handler key in batches sized for one reviewable PR per bank or per variant. |

**Registry source of truth:** [`listHandlers()`](../../../src/packages/statements/src/banks/handlers/registry.ts) and `handlerRegistryKey(bank, variant)`.

**Inventory:** 27 keys listed in [plan.md](../../../plan.md) (Variant Inventory table).

## Workflow

1. **Read** `src/packages/platform/data/credit-cards/<bank>/<variant>/research.md` and `catalog.json`. Note `default_kind`, `conflicts[]`, and `sources[]`.
2. **Fetch** issuer MITC and product pages. Prefer URLs already in `research.md`; use WebFetch or WebSearch when stale. Record each URL and `retrieved_at` (ISO date `YYYY-MM-DD`) in `research.md`.
3. **Update `research.md` first** — unstructured dump is fine. Call out conflicts (FAQ vs MITC). For `default` variants, document `default_kind` rationale per [plan.md Default Variant Semantics](../../../plan.md).
4. **Distill `catalog.json`:**
   - Nested groups, **snake_case** keys (see [data README](../../../src/packages/platform/data/credit-cards/README.md) and `CATALOG_GROUPS` in platform).
   - **Do not** change `display_name` during a source refresh. It is manually approved UI copy and may differ from issuer marketing titles. Only change it when the human requests a rename; then update [`approved-display-names.ts`](../../../src/packages/platform/tests/cards/approved-display-names.ts) in the same change. When adding a variant, set `display_name` once and add the key to that map.
   - `status: "NA"` requires `summary: "NA"`; otherwise write complete sentences without parenthetical asides.
   - **Named / sole_product:** After reading MITC and the product page for that SKU, set `NA` when the benefit is not offered (not `unknown` because marketing omitted a row). Add `notes` citing the documents checked. Keep `unknown` only if sources were missing or conflict on existence.
   - Lounge: `summary` is group overview; Priority Pass is a delivery mechanism, not a separate venue type.
   - **`default_kind: parser_fallback`:** avoid `yes` on lounge without MITC citation; prefer `depends` or `unknown` plus MITC links. Do not copy another variant’s `NA` onto the fallback. Validator warns on parser_fallback + lounge `yes`.
   - Bump **`updated_at`** on every catalog edit. Set **`researched_at`** when sources were re-checked.
   - Copy [`_template/catalog.json`](../../../src/packages/platform/data/credit-cards/_template/catalog.json) when adding a variant.
5. **Diff summary** for the human (required in your reply):
   - Sources touched and new `retrieved_at` dates.
   - Slots changed vs unchanged.
   - Remaining `unknown`, `depends`, `conflict` confidence, or `conflicts[]` entries.
6. **Handoff:** remind the user to run validation (workspace hook may block the agent):

```bash
cd /path/to/NetworthDB
bun run validate:card-catalog
```

Or `make check`.

## Schema Evolution

Adding a canonical group or field requires bumping `schema_version`, updating [`groups.ts`](../../../src/packages/platform/src/cards/groups.ts) and [`schema.ts`](../../../src/packages/platform/src/cards/schema.ts), and updating **every** `catalog.json`. See ADR-013.

## Waivers

If a handler key intentionally has no catalog, list it in [`_registry-waivers.json`](../../../src/packages/platform/data/credit-cards/_registry-waivers.json) with `reason` and `review_by`. Renew or remove waivers before `review_by` passes.

## Out of Scope

- API, web, or MCP code changes.
- Inventing spend-based eligibility or ledger linkage.
- Markdown rendering in the web app.

## Dry-Run Example: `idfc/wow`

**Goal:** Reconcile WOW! against MITC and product pages without inventing precision.

**Steps taken:**

1. Read `idfc/wow/research.md` and `catalog.json` (`default_kind: named`, lifetime free, 4X travel earn, lounge NA, known MITC vs FAQ conflicts).
2. Re-checked sources already cited: product page, wow-pdp FAQ, MITC PDF (retrieval dates in `sources[]`).
3. **Result:** No slot fact changes required on 2026-09-20; conflicts remain documented in `conflicts[]` and research notes (RP expiry, earn rate wording, cash advance fee).
4. **Diff summary:** Sources unchanged; `updated_at` not bumped because catalog prose was already aligned. Changelog appended in `research.md` for the maintenance pass.

When a refresh **does** change facts, bump `updated_at`, mirror dates in `sources[].retrieved_at`, and list every touched slot path (for example `fees.fuel_surcharge`, `rewards.expiry`).

## Related

- Data layout: [`src/packages/platform/data/credit-cards/README.md`](../../../src/packages/platform/data/credit-cards/README.md)
- Copilot read access: MCP tools `credit_cards_catalog_*` and `credit_cards_benefits_get` (HTTP only, not filesystem).
