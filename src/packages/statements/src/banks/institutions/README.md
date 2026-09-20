# Bank Institutions

Per-bank, per-variant statement handlers and parsers. This is the **only** place for bank-specific pipeline logic.

## Layout

```text
institutions/<bank>/
  index.ts              # exports handlers (and parsers if split) for registry wiring
  shared/
    parser.ts           # default CSV parser for the bank family
    layouts.ts          # layout detectors shared across variants
  <variant>/
    handler.ts          # exports one BankHandler (mail subjects + overrides)
```

Complex variants (e.g. `idfc/wow`, `pnb`) may add `summary-balances.ts`, `layout-v1.ts`, etc. under the variant folder.

## Add a Variant

1. Add `institutions/<bank>/<variant>/handler.ts` with `createBankHandler({ ... })`.
2. Register in [`handlers/registry.ts`](../handlers/registry.ts) and [`parsers/registry.ts`](../parsers/registry.ts) if parser differs.
3. Add fixtures under `tests/fixtures/<bank>/<variant>/format{N}.txt` (see `tests/fixtures/README.md`).

Cross-bank utilities stay in [`helpers/`](../helpers/). Registry types stay in [`shared/registry.ts`](../shared/registry.ts).
