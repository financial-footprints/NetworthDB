# ADR-013: Card Benefit Catalogs as Files, Shared via the HTTP API

## Status

Accepted

## Context

Credit-card benefits are reference data that issuers change often. Editors and AI assistants need to update them in reviewable diffs. The web app, the HTTP API, and MCP Copilot (ADR-010) must show the same facts. MCP is required to call the existing HTTP API rather than open a second data path.

## Decision

- Store catalogs as versioned files under `src/packages/platform/data/credit-cards/` next to sourced research notes, not in the database and not hardcoded in the web app or a TypeScript seed module.
- Validate files with a shared schema in the platform package. Load them through a platform loader.
- Expose catalogs to clients only through the versioned HTTP API. MCP Copilot consumes that API; it must not read catalog files itself.
- Keep benefit text in nested JSON objects with a fixed group taxonomy. Status `NA` is explicit and distinct from `unknown`.

## Consequences

### Positive

- Humans and AI can edit catalogs in pull requests with the same review path as other source.
- Issuer changes show up as file diffs instead of database mutations.
- Web, API, and MCP stay on one contract once read-only routes exist.

### Negative

- Adding a canonical group or field requires a schema-version bump and an update to every catalog file.
- The API process must be able to locate the data directory at runtime.

### Neutral

- Read-only HTTP routes are a later phase. This decision only places the files and the loader.

## Alternatives Considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Database table | Poor fit for reference data that should review in git |
| TypeScript seed module | Painful for manual and AI edits |
| Web-only constants | MCP could not reuse them without a second path, against ADR-010 |
| YAML catalogs | No YAML toolchain in the repo; JSON already matches Zod validation |

## References

- [ADR-010](010-mcp-copilot.md)
- [DEV.md](../DEV.md)
