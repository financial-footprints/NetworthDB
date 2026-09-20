# Production Deployment

Run NetworthDB on bare metal with Docker Compose. Local development still uses the repo-root [`docker-compose.yml`](../docker-compose.yml) (Postgres, Valkey, Mailpit) and [`make dev`](../docs/DEV.md).

This stack includes **Postgres (TLS)**, **Valkey**, **API**, **web UI (nginx)**, and **Copilot (HTTP MCP)**. It does **not** include Mailpit; configure real SMTP in `env/api.env`.

## Prerequisites

- Docker Engine with Compose v2
- A host reverse proxy for HTTPS (this stack serves plain HTTP on a published port)
- DNS and TLS certificates for your public hostname (WebAuthn and recovery links require HTTPS)

## Quick Start

From the repository root:

```bash
cd deploy
cp env/compose.env.example env/.env
cp env/api.env.example env/api.env
cp env/copilot.env.example env/copilot.env
cp env/postgres.env.example env/postgres.env
```

Edit the copied files:

1. Set strong passwords in `env/postgres.env` and matching `POSTGRES_*` / `POSTGRES_RO_*` in `env/api.env` and `env/copilot.env`.
2. Generate secrets: `openssl rand -hex 32` for `MFA_SECRET` and `FILESTORE_SECRET` in `env/api.env`.
3. Set `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_ORIGINS`, `CORS_ALLOW_ORIGINS`, and `RECOVERY_APP_BASE_URL` to your public `https://` origin.
4. Set `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM` for your mail relay (see [SMTP limits](#smtp) below).
5. Set `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` for the first administrator (only when the database has no users).

Build and start:

```bash
docker compose --env-file env/.env up -d --build
```

Compose reads `env/.env` for host port substitution (`WEB_HTTP_PORT`, `COPILOT_HTTP_PORT`). Service config uses the other files under `env/`.

Verify:

- Web UI: `http://127.0.0.1:${WEB_HTTP_PORT:-8080}` (or your proxy target port)
- Health: `http://127.0.0.1:${WEB_HTTP_PORT:-8080}/health`
- Copilot HTTP MCP (localhost only): `http://127.0.0.1:${COPILOT_HTTP_PORT:-8002}/mcp`

Sign in with the bootstrap administrator, create other users from the UI, then remove `BOOTSTRAP_ADMIN_PASSWORD` from `env/api.env` and redeploy if you change env files.

## Architecture

| Service | Role |
| --- | --- |
| `postgres` | Application database with self-signed TLS inside the stack |
| `valkey` | Sessions and auth rate limits |
| `migrate` | One-shot migrations, read-only role, bootstrap admin, seed SQL |
| `api` | Bun HTTP API (`qpdf` for statement PDFs) |
| `web` | nginx serving the SPA; proxies `/api/` and `/health` to the API |
| `copilot` | Optional HTTP MCP; published on `127.0.0.1` only |

Postgres and Valkey are **not** published on the host, so they can coexist with other Docker stacks. Compose project name is `networthdb-deploy` (separate volumes from dev).

## Environment Files

| File | Purpose |
| --- | --- |
| `env/.env` | Host ports (`WEB_HTTP_PORT`, `COPILOT_HTTP_PORT`) |
| `env/api.env` | API and migrate job (full variable list in [ENVIRONMENT.md](../docs/ENVIRONMENT.md)) |
| `env/copilot.env` | Copilot MCP |
| `env/postgres.env` | Postgres container credentials |

Committed `*.env.example` files are templates; real files under `deploy/env/` (including `env/.env`) are gitignored.

## Volumes

| Volume | Data |
| --- | --- |
| `postgres_data` | Database files |
| `postgres_ssl` | Generated Postgres TLS certificate |
| `valkey_data` | Valkey AOF |
| `filestore_data` | Vault files and backup staging (`FILESTORE_PATH`) |

## SMTP

The API SMTP client does not send username, password, or TLS (`secure`) today. Use a relay that accepts mail from the API container without SMTP AUTH, or extend `@ndb/notifications` for authenticated SMTP later.

## Operations

```bash
# Logs
docker compose --env-file env/.env logs -f api

# Re-run migrations after upgrading images (migrate is one-shot; run manually if needed)
docker compose --env-file env/.env run --rm migrate

# Stop
docker compose --env-file env/.env down

# Stop and remove data volumes (destructive)
docker compose --env-file env/.env down -v
```

## Production Requirements

With `ENVIRONMENT=production`, the API requires:

- `POSTGRES_SSLMODE` other than `disable` (use `require` with the bundled Postgres image)
- `FILESTORE_PATH` and `FILESTORE_SECRET`
- `WEBAUTHN_RP_ID` and `WEBAUTHN_RP_ORIGINS`
- No `*` in `CORS_ALLOW_ORIGINS`

Dev seed users (`admin` / `manasi` / `usher`) are **not** created in production; use bootstrap admin or an existing administrator to add users.

## Further Reading

- Variable reference: [docs/ENVIRONMENT.md](../docs/ENVIRONMENT.md)
- Local development: [docs/DEV.md](../docs/DEV.md)
