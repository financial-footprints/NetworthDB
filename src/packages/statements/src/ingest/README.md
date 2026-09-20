# Ingest

Input format handlers — extract text and attachments from raw sources. No vault writes.

## Layout

| Path | Role |
| ---- | ---- |
| `email/` | IMAP search, mbox iteration, attachment extraction, subject matching |
| `pdf/` | PDF text extraction via `pdfjs-dist` |
| `zip/` | ZIP archive extraction, password candidates |

## Dependencies

Third-party libraries only (`pdfjs-dist`, `@zip.js/zip.js`, `imapflow`, `mailparser`).
