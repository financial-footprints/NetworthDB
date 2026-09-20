---
name: bruno-tests
description: Write NetworthDB Bruno API tests with assert-first checks. Use when adding or editing .bru files or API end-to-end tests under src/apps/api/tests/bruno.
paths:
  - "src/apps/api/tests/bruno/**"
---

# Bruno Tests

Collection: `src/apps/api/tests/bruno`. Environment **Development** uses the test API on port **8001** (see `src/apps/api/.env.tests` and `src/scripts/tests/bruno.sh`).

## Prefer `assert` Over `tests`

Use an `assert` block for status, codes, scalars, `isDefined`, `isArray`, `gte`/`eq`, and nested fields.

Use `tests { }` only when JavaScript is required (`find`, `filter`, `every`, computed values). Keep an `assert` for `res.status` even when a `tests` block is required.

```bru
assert {
  res.status: eq 200
}
```

## Response Envelope Paths

Follow `/api-response-patterns`.

- List: `res.body.items`, `res.body.total`
- Details: `res.body.data.*` (camelCase fields)
- Error: `res.body.error`, `res.status`

## Hand-Written Request Shape

Match existing numbered folders (`00 Health`, `02 Profile`, `09 Accounts`, `10 Sources`, …):

- Filename / `meta.name`: `NN-MM Short Title`
- `docs` with `**Endpoint:**` and `**This test verifies:**` when helpful
- `{{BASE_URL}}` from environment (localhost **8001** for tests)
- Auth: Bearer session token or login flow vars from prior requests in the folder
- New folders need `folder.bru` with `seq`

## Reserved `res` Variable

Bruno injects `res` as the **main request response** in `assert`, `script:post-response`, and `tests` blocks. **Never declare `const res`** in scripts that call `bru.sendRequest`.

Use `prefetchRes`, `listRes`, `createRes`, etc.

```javascript
const prefetchRes = await bru.sendRequest({ method: "GET", url: getUrl, headers: auth });
```

## Shared `lib/` Scripts

Helpers live under `tests/bruno/lib/` (for example `bruno-totp`, `bruno-jobs`). In `script:pre-request` / `script:post-response`, require them from the **collection root** only:

```javascript
const { generateTotpCode } = require("./lib/bruno-totp/index.cjs");
```

Do **not** use `../lib/...` — Bruno CLI blocks paths that escape the collection sandbox.

## Running

Tell the user to run (workspace hook may block the agent):

```bash
cd /path/to/NetworthDB
make check
# or Bruno only:
bash src/scripts/tests/bruno.sh
```

## Related

- Envelope shapes: `/api-response-patterns`
- API routes: `/add-domain`
