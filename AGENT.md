# Agent

NetworthDB: Bun + Hono API over TypeScript domain and persistence packages, composed by `@ndb/bootstrap` (Argus-style). Only `@ndb/logger` uses Rust + NAPI.

## Commands

| Command        | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `make help`    | List make targets                                                |
| `make setup`   | Copy `src/apps/api/.env`, install, start Postgres, and migrate   |
| `make install` | `bun install` and NAPI debug build for logger                    |
| `make update`  | `cargo update` and `bun update` within current version ranges    |
| `make upgrade` | Latest stable Rust, Bun, and all dependencies                    |
| `make dev`     | Parallel dev: API + logger Rust watch                            |
| `make check`   | rustfmt, clippy, cargo test, biome, tsc, bun test, bruno         |
| `make ci`      | Check-only (no write), includes bun test and bruno             |
| `make clean`   | Remove `target/` and logger NAPI artifacts                       |

Run `make check` before considering work done. The agent cannot run install/build/test (workspace hook); hand those commands to the user.

## Package Map

| Path                       | Name                    | Role                                                              |
| -------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `src/packages/core`        | `@ndb/core`      | Domain center (TS). `domains/`, `shared/`, repository ports.        |
| `src/packages/database`    | `@ndb/database`  | Persistence (Drizzle + pg), migrations, seed scripts.           |
| `src/packages/logger`      | `@ndb/logger`    | JSON logging (Rust + NAPI). `createLogger()` from native binding.   |
| `src/packages/middleware`  | `@ndb/middleware`| HTTP cross-cutting (CORS, errors, request logging).             |
| `src/packages/bootstrap`   | `@ndb/bootstrap` | Composition root: config, runtime, services (TS only).              |
| `src/packages/platform`    | `@ndb/platform`  | TypeScript-only shared types/paths (no native code)               |
| `src/apps/api`             | `@ndb/api`       | Hono HTTP adapter. Uses `loadApiRuntime()` from bootstrap.        |

## Non-Negotiables

- Domain logic in `src/packages/core/src/`; Drizzle adapters in `src/packages/database/src/`
- Only `@ndb/logger` is a Rust NAPI package; future compute packages (e.g. NetworthCSV) follow the same pattern
- `@ndb/logger` is the NAPI package. Import `createLogger()` from it or via bootstrap.
- `src/apps/api` calls `loadApiRuntime()` from `@ndb/bootstrap`
- Use `createLogger()` for all operational logs; no `console.*` in TypeScript
- HTTP middleware lives in `@ndb/middleware`; session resolution goes through bootstrap services
- Dev uses `src/apps/api/.env` (PORT **8000**); tests and Bruno use committed `.env.tests` (PORT **8001**)

## References

- [docs/DEV.md](docs/DEV.md)
- [docs/adr/001-domain-driven-design.md](docs/adr/001-domain-driven-design.md)
