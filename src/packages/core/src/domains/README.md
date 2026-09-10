# Domain bounded contexts

Organize domain code by bounded context under `src/domains/<name>/`:

- `entities/` — domain entities and value objects
- `repositories/` — repository ports (interfaces)
- `services/` — application services and use cases
- `embedded/` — pure protocol logic with no I/O

Cross-cutting domain errors live in `src/shared/errors/`.

Infrastructure (Postgres, HTTP, NAPI) stays out of this package.
