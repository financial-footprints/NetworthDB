# HTTP Client

`@ndb/web` talks to the unified NetworthDB API (`@ndb/api`) through a single origin.

## Configuration

Set `PUBLIC_API_ORIGIN` in [`.env`](../../../.env) (copy from [`.env.example`](../../../.env.example); not committed). Leave it empty in local development to use same-origin relative paths (`/api/v1/...`, `/health`) through the Rsbuild dev proxy to `127.0.0.1:8000`.

## Paths and Types

- Route templates and `apiPath()` live in `@ndb/platform` as `API.*` and `apiPath`.
- [`client.ts`](client.ts) exposes `apiRequest` and `buildUrl` against that single origin. Prefer platform Zod schemas on each call.

## Authentication

- Login: `POST /api/v1/auth/login` with username and password.
- Session restore: `POST /api/v1/auth/refresh` with the stored refresh token.
- Authenticated calls send `Authorization: Bearer <sessionToken>`.
- Vault-unlocked requests that need the DEK use helpers in [`syncAuth.ts`](syncAuth.ts).

Route modules under [`routes/`](routes/) wrap `apiRequest` for auth, accounts, categories, tags, jobs, sources, backup, dashboard, and related resources. HTTP GET helpers are named `fetchX`; in-memory cache reads stay `readX`.
