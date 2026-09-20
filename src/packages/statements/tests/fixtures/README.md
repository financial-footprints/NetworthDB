# Statement text fixtures

Plain-text snapshots used by parser and metadata tests. Names follow `{bank}/{variant}/format{N}.txt` (for example `bob/easy/format1.txt`).

Content should match production: pdf.js text extraction after optional bank-specific `cleanText` on the handler. Regenerate from a local PDF:

```bash
cd src/packages/statements
bun ./scripts/extract-fixture-text.ts /path/to/statement.pdf tests/fixtures/bob/easy/format1.txt --bank bob --variant easy --password '…'
```

Expected opening/closing balances and statement periods live in `manifest.json`. Every `format*.txt` file must have a manifest entry and vice versa (`metadata-fixtures.test.ts`).

CSV fixtures (for example `icici/csv/`) are not PDF-derived and keep their own names.
