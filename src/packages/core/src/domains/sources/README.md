# Sources domain

Per-user extraction sources (Thunderbird profiles and IMAP email). Used by the statements pipeline to fetch account documents.

## Layout

| Path | Contents |
| --- | --- |
| `constants.ts` | IMAP default port |
| `entities/sources.ts` | `UserSources` aggregate, `Source` types, normalization, `withSourcesUpdate` |
| `repositories/sources-repository.ts` | Persistence port |
| `services/sources-service.ts` | GET/PUT use cases |

## Dependencies

- `SourcesService` uses `assertAal2` from `auth` for MFA step-up.
- `PipelineService` calls `requireSources` before enqueueing pipeline jobs.
- Blobs at rest are encrypted by `@ndb/database` adapters (NWENC1, ADR-004 tier 2).
- HTTP serializers compute `has_password` from `emailHasPassword` on the entity.
