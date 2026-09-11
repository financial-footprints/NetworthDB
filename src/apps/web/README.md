# @ndb/web

React UI for NetworthDB. Built with Rsbuild and Tailwind CSS.

## Setup

From the repo root:

```bash
make setup
make dev
```

- UI: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8000` (proxied from the dev server at `/api` and `/health`)

## Configuration

Copy [`.env.example`](.env.example) to `.env` (done automatically by `make setup`).

| Variable              | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `PORT`                | Dev server port (default `3000`)                                        |
| `PUBLIC_API_ORIGIN`   | API origin at build time. Leave empty to use same-origin + dev proxy.   |

## Development

```bash
bun run --filter @ndb/web dev
bun run --filter @ndb/web type-check
bun run --filter @ndb/web test
```

API contracts and path constants live in `@ndb/platform`.
