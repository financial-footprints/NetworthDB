# Statement entity adapter

This is the only place that maps `@ndb/core` domain entities to/from the Rust NAPI wire format.

If core entity shapes change, update converters here — not in `@ndb/core` and not in Rust `domain/`
(unless internal compute logic also needs the new fields).

Each module exports a converter object named after its domain type:

- `toDomain` — NAPI wire → `@ndb/core`
- `fromDomain` — `@ndb/core` → NAPI wire

```typescript
import { account, bank, statementList } from "@statements/convert";

bank.toDomain(nativeBank);
account.fromDomain(domainAccount);
statementList.toDomain(nativeList);
```

Flow:

```text
@ndb/core entities → src/convert/ → statements.node (wire) → napi/convert → domain/ → compute
```
