# Environment Variables

Variable reference for local development and tests. Setup workflow: [DEV.md](./DEV.md).

## Copy Samples

| App | Sample | Target |
| --- | --- | --- |
| API | `src/apps/api/.env.example` | `src/apps/api/.env` |
| Web | `src/apps/web/.env.example` | `src/apps/web/.env` |
| Copilot (MCP) | `src/apps/copilot/.env.example` | `src/apps/copilot/.env` |

`make setup` copies all three when missing. Database migrate/seed reads **`src/apps/api/.env`** (no separate database sample). Bruno and package tests use committed **`src/apps/api/.env.tests`** (API port **8001**).

Docker Compose provides Postgres (`localhost:5451`), Valkey (`KVSTORE_URL` default `redis://127.0.0.1:6379/0`), and Mailpit (SMTP `localhost:1025`, web UI <http://localhost:8025>). The API sample env uses `EMAIL_CHANNEL=smtp` with those SMTP settings so recovery email is visible in Mailpit during local dev. Set `EMAIL_CHANNEL=console` to log email to the API process instead.

## API (`src/apps/api/.env`)

Parsed by `@ndb/bootstrap` (`parseEnv`) and `@ndb/database` (`parseDbEnv`, `parseStorageEnv`).

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HOST` | Yes | — | API bind address |
| `PORT` | Yes | — | HTTP port (`8000` dev, `8001` in `.env.tests`) |
| `LOG_LEVEL` | Yes | — | `debug`, `info`, `warn`, or `error` |
| `ENVIRONMENT` | Yes | — | `local`, `development`, `staging`, or `production` |
| `CORS_ALLOW_ORIGINS` | No | `[]` | Comma-separated allowed browser origins; empty allows none unless localhost CORS is enabled in non-production |
| `POSTGRES_USER` | Yes | — | Postgres role for read-write API pool |
| `POSTGRES_PASSWORD` | Yes | — | Password for `POSTGRES_USER` |
| `POSTGRES_HOST` | Yes | — | Postgres host |
| `POSTGRES_PORT` | Yes | — | Postgres port |
| `POSTGRES_DATABASE` | Yes | — | Database name |
| `POSTGRES_SSLMODE` | Yes | — | `disable`, `require`, or `verify-full` |
| `POSTGRES_RO_USER` | Yes | — | Read-only role (Copilot SQL + migrate grant) |
| `POSTGRES_RO_PASSWORD` | Yes | — | Password for `POSTGRES_RO_USER` |
| `KVSTORE_URL` | Yes | — | Valkey/Redis URL for sessions and rate limits |
| `SESSION_TTL` | Yes | — | Session token lifetime (e.g. `15m`) |
| `REFRESH_TTL` | Yes | — | Refresh token lifetime (e.g. `720h`) |
| `MFA_CHALLENGE_TTL` | Yes | — | MFA challenge token lifetime |
| `MFA_SECRET` | No | — | TOTP encryption secret (required for MFA in practice) |
| `MFA_MAX_FAILURES` | No | `5` | Failed MFA attempts before lockout |
| `MFA_LOCKOUT_TTL` | Yes | — | MFA lockout duration |
| `MFA_TOTP_SKEW` | No | `1` | TOTP time-step skew |
| `MFA_REQUIRED_ROLES` | No | `[]` | Comma-separated roles that must enroll MFA |
| `AUTH_RATE_LIMIT` | No | `20` | Auth endpoint rate limit count |
| `AUTH_RATE_WINDOW` | No | `60s` | Auth rate limit window |
| `WEBAUTHN_RP_DISPLAY_NAME` | No | — | WebAuthn relying party display name |
| `WEBAUTHN_RP_ID` | No | — | WebAuthn RP ID (e.g. `localhost`) |
| `WEBAUTHN_RP_ORIGINS` | No | `[]` | Comma-separated allowed WebAuthn origins |
| `RECOVERY_APP_BASE_URL` | No | — | Base URL for recovery email links |
| `RECOVERY_PASSWORD_TOKEN_TTL` | No | `1h` | Password reset token lifetime |
| `RECOVERY_ADVANCED_TOKEN_TTL` | No | `30m` | Advanced recovery token lifetime |
| `EMAIL_CHANNEL` | No | — | `console` or `smtp` |
| `SMTP_HOST` | No | — | SMTP host when `EMAIL_CHANNEL=smtp` |
| `SMTP_PORT` | No | — | SMTP port |
| `SMTP_FROM` | No | — | SMTP from address |
| `FILESTORE_SECRET` | Conditional | — | Hex key for NWENC1 at-rest encryption; required in production |
| `FILESTORE_PATH` | No | — | Host path for vault files and backup staging |
| `BACKUP_MAX_UPLOAD_BYTES` | No | `536870912` | Max backup import upload size |
| `JOBS_MAX_WORKERS` | No | `10` | Concurrent in-process jobs and statement worker threads |
| `DISABLE_ADVANCED_SECURITY` | No | `false` | When `true`, relaxes advanced security checks (local debug) |
| `SEED_RESET_USER_DATA` | No | — | **`true` in `.env.tests` only:** reset seed users' accounts/jobs/backup exports/sources/vault before seed |

## Web (`src/apps/web/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | Rsbuild dev server port |
| `PUBLIC_API_ORIGIN` | No | — | Browser API base; empty uses dev proxy to API |

## Copilot (`src/apps/copilot/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `LOG_LEVEL` | No | `info` | Copilot log level |
| `ENVIRONMENT` | No | `local` | Same enum as API |
| `API_ORIGIN` | Yes | — | HTTP API base (e.g. `http://127.0.0.1:8000`) |
| `MCP_TRANSPORT` | No | `stdio` | `stdio` (Cursor) or `http` (`make dev`) |
| `HOST` | No | `127.0.0.1` | HTTP MCP bind address |
| `PORT` | No | `8002` | HTTP MCP port |
| `POSTGRES_HOST` | Yes | — | Same as API |
| `POSTGRES_PORT` | Yes | — | Same as API |
| `POSTGRES_DATABASE` | Yes | — | Same as API |
| `POSTGRES_SSLMODE` | Yes | — | Same as API |
| `POSTGRES_RO_USER` | Yes | — | Read-only role |
| `POSTGRES_RO_PASSWORD` | Yes | — | Read-only password |
| `NDB_USERNAME` | No | — | Optional startup MCP login |
| `NDB_PASSWORD` | No | — | Optional startup MCP login (requires username) |
| `NDB_TOTP` | No | — | Optional TOTP for startup login |

## HTTP Contract Exceptions

Some **request** shapes stay snake_case on the wire (not response JSON):

- Statement file upload multipart: `account_id`, `statement_kind`, `covered_month`, `year_key`
- Statement sync JSON: `accountId`, optional `financialYear`
- Statement file download query: `statement_date`, `format`

E2EE client settings may use snake_case keys inside `clientSettings.e2ee` (e.g. `account_number`).
