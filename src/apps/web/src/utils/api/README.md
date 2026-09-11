# HTTP client

`@ndb/web` talks to the unified NetworthDB API (`@ndb/api`) through a single origin.

## Configuration

Set `PUBLIC_API_ORIGIN` in [`.env`](../../../.env) (copy from [`.env.example`](../../../.env.example); not committed). Leave it empty in local development to use same-origin relative paths (`/api/v1/...`, `/health`) through the Rsbuild dev proxy to `127.0.0.1:8000`.

## Paths and types

- Route templates live in `@ndb/platform` as `API.*`.
- Use [`path.ts`](path.ts) `apiPath()` to substitute path parameters.
- [`client.ts`](client.ts) exposes `get`, `post`, `put`, `patch`, `del`, and `buildUrl` against that single origin.

## Authentication

- Login: `POST /api/v1/auth/login` with username and password.
- Session restore: `POST /api/v1/auth/refresh` with the stored refresh token.
- Authenticated calls send `Authorization: Bearer <session_token>`.
- Vault-unlocked requests that need the DEK use helpers in [`syncAuth.ts`](syncAuth.ts).

Endpoint modules under [`endpoints/`](endpoints/) wrap the shared client for auth, accounts, jobs, sources, and related resources.
