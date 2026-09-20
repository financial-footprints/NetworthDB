# ADR-010: MCP Copilot Host

## Status

Accepted

## Context

Users want AI assistants (Cursor, Claude Desktop) to operate NetworthDB with the same capabilities as the web UI, plus ad-hoc read-only SQL for analytics. The product already has a single HTTP API composition root, opaque sessions, MFA, and a tiered encryption policy. MCP must not introduce a second runtime that runs background jobs or bypasses those rules.

## Decision

### Apps and Packages

- **`@ndb/mcp`** — MCP server factory: tools, resources, and prompts. Mutations are implemented as an HTTP client to the existing API, not as direct domain wiring. No `loadApiRuntime()`.
- **`@ndb/copilot`** — Host process that speaks MCP over **stdio** by default (for IDE subprocesses). **Streamable HTTP** is optional in v1 (`MCP_TRANSPORT=http`, localhost bind by default) for MCP Inspector; it uses the same opaque session Bearer as the web client, not Entra or a second API runtime.

### Authentication

Every MCP connection must map to a NetworthDB user before any data access. Only authentication status tools (and static documentation resources) are available without a session. API calls use the same opaque Bearer session as the web client. MFA and AAL2 rules remain enforced by the API.

### Mutations and Read-Only SQL

- **Writes** — Only through existing versioned HTTP endpoints (including async jobs). Domain validation and authorization stay on the API.
- **Ad-hoc SQL** — A dedicated Postgres login with `default_transaction_read_only`, column grants that exclude secrets, and row-level policies scoped to `current_setting('app.user_id')` from the authenticated session. The path is intentionally thin: schema documentation for the model, a guarded single-statement `SELECT` / `WITH` / `EXPLAIN`, row limits — no query rewriter and no server-side decryption of E2EE fields.

### E2EE (V1)

MCP does not hold the vault data encryption key. Tier-1 fields are returned as stored (opaque when E2EE toggles are on). Users who need plaintext display names or account numbers in MCP disable the optional E2EE toggles in the web UI. A local decrypt companion (`aikey` / NetworthAES) is out of scope for v1.

### Out of Scope (V1)

In-product chat, LLM API keys in the repo, personal access tokens, vault or WebAuthn enrollment via MCP, and client-side decrypt helpers.

## Alternatives Considered

| Alternative | Why rejected |
| ----------- | ------------ |
| MCP calls `loadApiRuntime()` directly | Duplicates job runner and statement pool; unsafe with API in parallel |
| MCP writes via raw SQL | Bypasses API validation, AAL2, and jobs |
| MCP decrypts E2EE in the host | Requires DEK in a process that may run over HTTP; deferred |

## Consequences

### Positive

- AI parity with the UI without duplicating domain logic in MCP.
- Ledger analytics via SQL while tenant isolation stays at the database for the read-only role.

### Negative

- Operators must understand E2EE pass-through limits until a future local decrypt companion exists.
- Local development requires the API and the copilot MCP process to be configured separately.

### Neutral

- Implementation rolls out in phases; foundations ship a connectivity-only MCP host before auth, SQL, and product tools.

## References

- [ADR-001](001-domain-driven-design.md)
- [ADR-002](002-authentication.md)
- [ADR-003](003-end-to-end-encryption.md)
- [ADR-004](004-data-encryption-policy.md)
- [ADR-006](006-transactions-ledger.md)
