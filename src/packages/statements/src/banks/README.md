# Banks

Per-institution statement handlers and transaction parsers.

## Layout

| Path | Role |
| ---- | ---- |
| [`institutions/`](institutions/) | **Canonical** bank + variant handlers, parsers, layouts |
| `handlers/` | `base.ts`, `registry.ts`, public `getHandler` API only |
| `parsers/` | `common.ts`, `registry.ts`, public `getParser` API only |
| `helpers/` | Shared text, date, amount, and table utilities |
| `shared/` | Registry, period resolution, **mixins** (cross-bank handler helpers) |

See [institutions/README.md](institutions/README.md) for variant folder conventions.

## Dependencies

- `period/` — billing and statement period keys
- `ingest/` — PDF text extraction (handlers call into ingest helpers)
