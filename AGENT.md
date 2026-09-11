# Agent

NetworthDB: Bun + Hono API over TypeScript domain and persistence packages, composed by `@ndb/bootstrap` (Argus-style). `@ndb/logger` and `@ndb/statements` use Rust + NAPI.

## Commands

| Command        | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `make help`    | List make targets                                                |
| `make setup`   | Copy `src/apps/api/.env`, install, start Postgres, and migrate   |
| `make install` | `bun install` and NAPI debug builds for logger and statements   |
| `make update`  | `cargo update` and `bun update` within current version ranges    |
| `make upgrade` | Latest stable Rust, Bun, and all dependencies                    |
| `make dev`     | Parallel dev: API + logger/statements Rust watch                 |
| `make check`   | rustfmt, clippy, cargo test, biome, tsc, bun test, bruno         |
| `make ci`      | Check-only (no write), includes bun test and bruno             |
| `make clean`   | Remove `target/` and NAPI artifacts (logger, statements)         |

Run `make check` before considering work done. The agent cannot run install/build/test (workspace hook); hand those commands to the user.

## Package Map

| Path                       | Name                    | Role                                                              |
| -------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `src/packages/core`        | `@ndb/core`      | Domain center (TS only). `domains/` (`user`, `auth`, `account`, `jobs`, `sources`), `shared/`, repository ports. |
| `src/packages/auth`        | `@ndb/auth`      | Auth service factory and KV rate-limit wiring for bootstrap.        |
| `src/packages/database`    | `@ndb/database`  | Persistence (Drizzle + pg), migrations, seed scripts.           |
| `src/packages/notifications` | `@ndb/notifications` | Email delivery (`console` / `smtp`) for recovery flows.         |
| `src/packages/logger`      | `@ndb/logger`    | JSON logging (Rust + NAPI). `createLogger()` from native binding.   |
| `src/packages/statements`  | `@ndb/statements`| Statement compute (Rust + NAPI) + TS adapter (`createStatementEngine`). Owns `FILESTORE_PATH`, vault I/O, pipeline stages, bank parsers. |
| `src/packages/middleware`  | `@ndb/middleware`| HTTP cross-cutting (CORS, errors, request logging).             |
| `src/packages/bootstrap`   | `@ndb/bootstrap` | Composition root: config, runtime, services (TS only).              |
| `src/packages/platform`    | `@ndb/platform`  | TypeScript-only shared types/paths (no native code)               |
| `src/apps/api`             | `@ndb/api`       | Hono HTTP adapter. Uses `loadApiRuntime()` from bootstrap.        |
| `src/apps/web`             | `@ndb/web`       | React UI (Rsbuild). Dev `http://127.0.0.1:3000`, proxies `/api` to API :8000. |

## Non-Negotiables

- Domain logic in `src/packages/core/src/`; Drizzle adapters in `src/packages/database/src/`
- Rust NAPI packages: `@ndb/logger` (logging) and `@ndb/statements`
- Import `createLogger()` from `@ndb/logger` or via bootstrap; import compute APIs from `@ndb/statements`
- `src/apps/api` calls `loadApiRuntime()` from `@ndb/bootstrap`
- Use `createLogger()` for all operational logs; no `console.*` in TypeScript
- HTTP middleware lives in `@ndb/middleware`; session resolution goes through bootstrap services
- Dev uses `src/apps/api/.env` (PORT **8000**); tests and Bruno use committed `.env.tests` (PORT **8001**)
- Classify new sensitive fields per [docs/adr/004-data-encryption-policy.md](docs/adr/004-data-encryption-policy.md)

## References

- [docs/DEV.md](docs/DEV.md)
- [docs/adr/001-domain-driven-design.md](docs/adr/001-domain-driven-design.md)
- [docs/adr/004-data-encryption-policy.md](docs/adr/004-data-encryption-policy.md)
- [docs/adr/005-statements-compute.md](docs/adr/005-statements-compute.md)
