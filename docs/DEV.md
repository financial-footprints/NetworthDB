# Developer Guide

## Prerequisites

- [Bun](https://bun.sh)
- [Docker](https://www.docker.com) (Postgres, Valkey, Mailpit)

## Quick Start

```bash
make setup
make dev
```

| Service  | URL / connection                                      |
| -------- | ----------------------------------------------------- |
| API      | <http://127.0.0.1:8000/health>                          |
| Web UI   | <http://127.0.0.1:3000> (proxies `/api` to the API)     |
| Postgres | `localhost:5451` — database/user/password: `networthdb` |
| Mailpit  | <http://localhost:8025> — local SMTP inbox (recovery emails when API uses `EMAIL_CHANNEL=smtp`) |

`make setup` copies env samples when missing:

| Sample | Target |
| --- | --- |
| `src/apps/api/.env.example` | `src/apps/api/.env` |
| `src/apps/web/.env.example` | `src/apps/web/.env` |
| `src/apps/copilot/.env.example` | `src/apps/copilot/.env` |

Copilot HTTP listens on **8002** when started via `make dev` (`MCP_TRANSPORT=http`). Cursor uses stdio via [`.cursor/mcp.json`](../.cursor/mcp.json) (`start` / default transport).

## Package Map

| Path | Package | Responsibility |
| --- | --- | --- |
| `src/apps/api` | `@ndb/api` | Hono HTTP adapter; routes and serializers |
| `src/apps/web` | `@ndb/web` | Rsbuild + React Router SPA |
| `src/apps/copilot` | `@ndb/copilot` | MCP host (stdio default; optional HTTP) |
| `src/packages/core` | `@ndb/core` | Domain entities, services, ports — see [domains README](../src/packages/core/src/domains/README.md) |
| `src/packages/database` | `@ndb/database` | Drizzle schema, migrations, repository implementations |
| `src/packages/platform` | `@ndb/platform` | Zod API contracts, paths, shared client types |
| `src/packages/bootstrap` | `@ndb/bootstrap` | Composition root (`loadApiRuntime`) |
| `src/packages/middleware` | `@ndb/middleware` | CORS, logging, error handler, session auth |
| `src/packages/logger` | `@ndb/logger` | Structured logging |
| `src/packages/auth` | `@ndb/auth` | Crypto adapters, Valkey rate limits |
| `src/packages/encryption` | `@ndb/encryption` | NWENC1 server blob encryption |
| `src/packages/statements` | `@ndb/statements` | Statement pipeline and worker pool |
| `src/packages/notifications` | `@ndb/notifications` | Email delivery |
| `src/packages/mcp` | `@ndb/mcp` | MCP protocol, tools, HTTP client to API |

## Environment Variables

Full names and defaults: [ENVIRONMENT.md](./ENVIRONMENT.md).

Web route modules under `src/apps/web/src/utils/api/routes/` call the API through `apiRequest` in `src/apps/web/src/utils/api/client.ts`.

## Parallel Statement Sync

Bulk **sync all credit cards** in the UI fires one HTTP job per card. Up to `JOBS_MAX_WORKERS` pipelines run at once (default **10** in `.env.example`; Bruno/tests use `2` in `.env.tests`).

| Layer | Role |
| ----- | ---- |
| `JobRunnerService` | Schedules up to N job callbacks concurrently |
| `createPool({ threads: N })` | Runs pipeline compute in `worker_threads` |

During `make dev`, pipeline workers write tagged JSON log lines to the terminal (`jobId`, `accountId`). Lines from multiple workers interleave — that is expected. The API `/health` endpoint stays responsive while sync jobs run.

Set `JOBS_MAX_WORKERS=10` (or higher) in `src/apps/api/.env` when testing parallel sync locally.

When many credit-card accounts share one Gmail IMAP login, **sync them one at a time** (UI or single-account API calls). Parallel jobs open concurrent IMAP sessions and often fail with `Connection not available` before staged PDFs reach cleanup. See [plan.md](../../plan.md) pipeline recovery notes.

## Database

Migrations run during `make setup`. With `ENVIRONMENT=local`, seed creates dev users (`admin`, `manasi`, `usher`; password `admin`).

Apply migrations manually:

```bash
bun run --filter @ndb/database migrate
```

Generate migrations after schema changes:

```bash
make migrations name=<name>
```

Schema lives in `src/packages/database/src/schema/`. Do not hand-edit files under `drizzle/migrations/`.

Credit card account labels are the catalog `display_name` (for example `Easy Shopping`), not `bank (variant)`. After deploying that change, backfill existing rows once:

```bash
bun run --filter @ndb/database backfill:credit-card-labels
```

## Make Targets

| Target       | Description                                    |
| ------------ | ---------------------------------------------- |
| `help`       | List targets                                   |
| `install`    | `bun install`                                  |
| `setup`      | Env files, install, Postgres, migrate          |
| `migrations` | Generate Drizzle migrations (`name=<name>`)    |
| `update`     | `bun update` within current ranges             |
| `upgrade`    | Latest Bun and dependencies                    |
| `dev`        | Postgres + parallel API, web, and Copilot HTTP |
| `kill`       | Free app ports and stop Postgres               |
| `check`      | biome, markdownlint, type-check, tests, depcruise, Bruno |
| `ci`         | check without setup or format writes           |
| `clean`      | Remove `node_modules`, build dirs, caches; stop Postgres |

## MCP Copilot (Cursor / Claude Desktop)

The **`@ndb/copilot`** app is an MCP host. **stdio** is the default (Cursor subprocess). Optional **Streamable HTTP** (`MCP_TRANSPORT=http`) listens on `http://127.0.0.1:8002/mcp` by default (`HOST` / `PORT` in `src/apps/copilot/.env`). The host talks to the running HTTP API (`API_ORIGIN`, default `http://127.0.0.1:8000`). Start **`make dev`** (or the API alone) before using auth or HTTP MCP.

The MCP server registers the full tool catalog at startup (about 70 tools). Session-gated tools still require `auth_login` (or startup env credentials) before they succeed; unauthenticated calls return `mcp.auth.unauthenticated`.

| Tool | Session required |
| ---- | ---------------- |
| `ping` | No |
| `auth_login` | No (establishes session) |
| `auth_status` | No (reports current session) |
| `schema_describe` | Yes |
| `sql_query` | Yes |
| `accounts_list`, `accounts_get`, `accounts_create`, `accounts_patch`, `accounts_delete`, `accounts_banks`, `accounts_system`, `accounts_metadata` | Yes |
| `statements_sync`, `statements_upload`, `statements_download`, `statements_mark_synced` | Yes |
| `sources_get`, `sources_put` | Yes |
| `transactions_list`, `transactions_create`, `transactions_patch`, `transactions_delete`, `transactions_batch`, `transactions_bulk`, `transactions_bulk_delete`, `transactions_summary`, `transactions_balance`, `transactions_import_create`, `transactions_import_delete` | Yes |
| `credit_cards_catalog_list`, `credit_cards_catalog_get`, `credit_cards_catalog_bulk`, `credit_cards_benefits_get` | Yes |
| `categories_list`, `categories_create`, `categories_patch`, `categories_delete` | Yes |
| `tags_list`, `tags_create`, `tags_patch`, `tags_delete` | Yes |
| `rule_groups_list`, `rule_groups_get`, `rule_groups_create`, `rule_groups_patch`, `rule_groups_delete`, `rule_groups_apply` | Yes |
| `rules_list`, `rules_get`, `rules_create`, `rules_patch`, `rules_delete`, `rules_test`, `rules_apply` | Yes |
| `jobs_list`, `jobs_get`, `jobs_cancel`, `jobs_wait` | Yes |
| `backup_export`, `backup_import`, `backup_download`, `backup_status` | Yes |
| `profile_get`, `profile_patch` | Yes |
| `users_admin_list`, `users_admin_create`, `users_admin_patch`, `users_admin_delete` | Yes (manager/admin; role `user` blocked in MCP for admin tools) |

Optional env login: set `NDB_USERNAME`, `NDB_PASSWORD`, and `NDB_TOTP` in `src/apps/copilot/.env` to authenticate at startup. Call `schema_describe` before `sql_query`. After async tools (sync, upload, backup, rules apply), use `jobs_wait` or `GET /api/v1/jobs/{jobId}`. `backup_status` shows the current 7-day export; `backup_download` writes that file (no job id). Export and import require a ZIP password of at least 8 characters.

**MCP resources:** `ndb://docs/*` (howto, ledger, taxonomy, rules, jobs) are readable without a session. `ndb://schema`, `ndb://schema/{table}`, and live URIs (`ndb://me`, `ndb://accounts`, `ndb://categories`, `ndb://tags`, `ndb://rule-groups`, `ndb://system-accounts`, `ndb://accounts/{id}`) require login. **Prompts** (e.g. `monthly_review`, `spending_by_category`) are instruction templates and also require a session.

`make setup` / `bun run --filter @ndb/database migrate` upserts the Postgres role `networthdb_readonly` (from `POSTGRES_RO_*` in `src/apps/api/.env`) via `operations/migrate/role.ts`. Copilot opens a read-only **`pg.Pool`** and `createReadonlySqlExecutor` at startup (`mcp.db.readonly.ready` in `mcp-stdio.ts`). SQL runs with `SET LOCAL app.user_id` and RLS; results cap at 500 rows.

If you already have `.env` files from an earlier setup, merge new keys from `.env.example` (`POSTGRES_RO_*` on the API env; `POSTGRES_HOST` / `PORT` / `DATABASE` / `SSLMODE` / `POSTGRES_RO_*` on copilot).

1. `make setup` copies `src/apps/copilot/.env.example` → `src/apps/copilot/.env` (`LOG_LEVEL`, `ENVIRONMENT`, `API_ORIGIN`, Postgres RO settings).
2. **Cursor:** project config is [`.cursor/mcp.json`](../.cursor/mcp.json). It runs Bun with `${workspaceFolder}/src/apps/copilot/.env` and `${workspaceFolder}/src/apps/copilot/src/index.ts` (do not rely on `cwd`; Cursor’s shared MCP process often ignores it, which yields `Module not found "src/index.ts"` and then `-32000` / connection closed). Cursor does not load your shell profile, so `command` should be an absolute Bun path (for example `/home/YOU/.bun/bin/bun`). `spawn bun ENOENT` means the binary was not found, not an AppArmor exec denial. Stdio MCP speaks JSON-RPC on **stdout**; copilot logs go to **stderr**.
3. **Other MCP clients:** copy [src/apps/copilot/mcp.json.example](src/apps/copilot/mcp.json.example) and fix the Bun path. Args use `${workspaceFolder}` so the entry file resolves even when the client ignores `cwd`.
4. Manual smoke test from the repo root: `bun --env-file src/apps/copilot/.env src/apps/copilot/src/index.ts`.

**E2EE:** MCP returns tier-1 fields as stored. Plaintext `account_number` / `display_name` writes fail when E2EE toggles are on; disable optional fields in Profile → Encryption if you need plaintext in MCP.

**MFA:** The API still enforces AAL2 for protected routes. MCP login is username/password plus optional TOTP or recovery code. There are no vault or WebAuthn enrollment tools over MCP.

**HTTP MCP (Inspector):** Set `MCP_TRANSPORT=http`, start copilot, then point MCP Inspector at `http://127.0.0.1:8002/mcp` with `Authorization: Bearer <sessionToken>` (obtain a session via the web UI or `POST /api/v1/auth/session/login`). Requests without a valid Bearer receive **401** before tools or SQL run.

## Statement Compute

`@ndb/statements` is pure TypeScript: extract, cleanup, metadata, parse, vault I/O, and a worker pool. Bootstrap wires `wrap(createPool(...), config)` at API startup. See [src/packages/statements/README.md](../src/packages/statements/README.md).

**Bank PDF passwords:** `qpdf` must be on `PATH` before the API starts (`createPool` throws `bootstrap.statements.required.not-found.qpdf` if missing; `apt install qpdf` on Debian). Cleanup strips issuer PDF encryption with qpdf, then stores plaintext PDF bytes in the vault (NWENC1 at-rest encryption is separate). Account statement passwords must be configured so pdf.js can open attachments and extract text.

## Further Reading

Architecture decisions: [docs/adr/](adr/README.md).

Agent and coding conventions: [AGENT.md](../AGENT.md).

Environment variables: [ENVIRONMENT.md](./ENVIRONMENT.md).
