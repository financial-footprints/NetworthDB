# Credit card benefits catalog (data)

Human-edited reference data for card benefits, keyed by the same **bank / variant** pairs as `@ndb/statements` handlers (`listHandlers()`).

`catalog.json` is the **frontend contract** (and the API/MCP contract). `research.md` is the sourced dump that catalogs are distilled from. Do not load either file in the statement pipeline.

This tree lives in **`@ndb/platform`** at `src/packages/platform/data/credit-cards/` (next to the package `src/` tree).

## Layout

```text
src/packages/platform/data/credit-cards/
  <bank>/<variant>/
    catalog.json    # Nested Zod-validated benefits
    research.md     # Sourced notes
  _template/
    catalog.json    # Copy when adding a new variant
```

Paths mirror statement fixtures: `tests/fixtures/<bank>/<variant>/`.

## Editing

- Edit `catalog.json` and `research.md` together. Cite issuer URLs in `research.md` and copy them into `sources[]`.
- Distill catalogs from `research.md`. Preserve `conflict` where issuer sources disagree on facts.
- **`unknown` vs `NA`:** Use `unknown` only when the MITC or product page could not be checked, or official sources disagree on whether the benefit exists. For **`default_kind: named`** (and `sole_product`) variants, when MITC and the product page for that SKU omit a benefit category (golf, railway lounge, separate UPI earn, and similar), set `status: "NA"` and `summary: "NA"` with `verified_mitc` or `verified_product_page` and a short `notes` sentence naming what was read. Do **not** use `unknown` for confirmed absence on a named card.
- **`parser_fallback`:** Do not infer product-specific benefits or flip slots to `NA` from another variant’s MITC; keep `depends` or `unknown` as today.
- JSON keys are `snake_case`. Groups are nested objects, not dotted map keys.
- When `status` is `NA`, `summary` must be exactly `"NA"`.
- Otherwise write complete sentences. Avoid parenthetical asides.
- Bump `updated_at` on every catalog edit.
- Copy [`_template/catalog.json`](_template/catalog.json) when adding a variant, then fill every required field.

### Display names

Each catalog’s `display_name` is **manually approved UI copy** (short product titles for the comparison table and API). It may differ from the issuer’s marketing page; that is intentional.

- Do **not** change `display_name` when refreshing slots from MITC or product pages.
- To rename a card or add a variant: set `display_name` in `catalog.json`, add the same `registry_key` → name pair to [`approved-display-names.ts`](../../tests/cards/approved-display-names.ts), and bump `updated_at`. [`display-names.test.ts`](../../tests/cards/display-names.test.ts) fails on any mismatch.

## Schema

Validated by `@ndb/platform` (`cardCatalogSchema`, `schema_version` 1). Adding a group or field requires a version bump and an update to every `catalog.json`.

**Display order** (also `CATALOG_GROUPS` in platform; **welcome last**):

```text
fees:        joining, annual, annual_waiver, forex, fuel_surcharge
rewards:     base_earn, accelerated, upi, redemption, expiry
lounge:      summary (UI label: Overview), domestic, international, railway
lifestyle:   dining, movies, golf, concierge
insurance:   travel, accident, card_protect
milestones:  top-level slot
welcome:     top-level slot, last row in the UI
```

Lounge `summary` is the group overview: Priority Pass is a **delivery mechanism** for domestic and/or international visits, not a fourth venue type. Spend gates that apply across lounge types belong here.

**`status`:** `yes` | `conditional` | `depends` | `unknown` | `NA`

## Loader

The platform loader reads this tree, validates JSON, and indexes by `registry_key`. `registry_key`, `bank`, and `variant` must match the folder path.

Filesystem loading lives in [`load.ts`](../../src/cards/load.ts). Server apps import loaders and waivers from `@ndb/platform/cards/server` ([`server.ts`](../../src/cards/server.ts)), not the main `@ndb/platform` barrel (the web bundle must not pull `node:fs`). Client-safe flattening for UI lives in [`flatten.ts`](../../src/cards/flatten.ts) via `@ndb/platform`.

By default, `resolveCardCatalogDir()` uses this directory via `packageCardCatalogDataDir()` in `load.ts`. Override with `NDB_DATA_DIR` pointing at a parent directory (with optional `credit-cards/` child) or directly at a catalog root.

`_template/` and other underscore-prefixed folders are skipped.

## Validator

Every `listHandlers()` key must have a valid `catalog.json`. Extra variant folders fail unless listed in `_registry-waivers.json` (none today).

```bash
cd /path/to/NetworthDB
bun run validate:card-catalog
```

This also runs from `make check` / `make ci`.

## Manual refresh checklist

1. Open `src/packages/platform/data/credit-cards/<bank>/<variant>/research.md` and `catalog.json`.
2. Update research from issuer MITC and product pages; cite URLs and retrieval dates.
3. Distill changes into `catalog.json`; bump `updated_at` (and `researched_at` when sources were re-checked).
4. Append a dated bullet under a **Changelog** section in `research.md` (or maintain per-variant `CHANGELOG.md` for long histories).
5. Run `bun run validate:card-catalog` or `make check`.
6. Open a PR with the file diff only; MITC prevails over marketing copy in disputes.

## AI-assisted refresh

Use the Cursor skill [`.cursor/skills/update-credit-card-benefits/SKILL.md`](../../../../.cursor/skills/update-credit-card-benefits/SKILL.md). The same validation gate applies: the agent must not skip `validate:card-catalog`. Copilot reads catalogs through MCP HTTP tools (`credit_cards_catalog_*`, `credit_cards_benefits_get`), not by reading this folder directly.

## Registry waivers

Every handler key needs a `catalog.json` unless waived. Edit [`_registry-waivers.json`](_registry-waivers.json):

```json
{
  "waivers": [
    {
      "key": "bank/variant",
      "reason": "Why the catalog is intentionally absent",
      "review_by": "2026-12-31"
    }
  ]
}
```

The validator warns when `review_by` is in the past so waivers are renewed or removed.

## Schema evolution

When adding a canonical group or field, bump `schema_version`, update `CATALOG_GROUPS` and `cardCatalogSchema` in `@ndb/platform`, refresh every `catalog.json`, and extend platform tests. See [ADR-013](../../../../docs/adr/013-card-benefit-catalogs.md).
