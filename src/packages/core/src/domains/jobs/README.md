# Jobs domain

Job queue bounded context: persist user-scoped background work, run it in-process, and expose list/get/cancel.

## Vocabulary

| Term | Meaning |
| ---- | ------- |
| **Job** | Persisted background-work record (status, stage, scope, output) |
| **JobScope** | Account/year key for conflict detection (`accountId`, `financialYear`) |
| **JobStage** | Kind of work: `upload`, `sync` |

Statement pipeline processing lives under [`account/modules/statements/`](../account/modules/statements/). `createPipelineContext()` maps `JobScope` into `PipelineContext.scope` for `StatementEngine`.

## Service layout

| Service                                 | Role                                                               |
| --------------------------------------- | ------------------------------------------------------------------ |
| [`JobService`](services/job-service.ts) | HTTP use cases: list, get, cancel (AAL2 step-up)                   |
| [`JobRunnerService`](services/job-runner-service.ts)   | In-process worker pool, cooperative cancel, orphan recover on boot |

**JobService vs JobRunnerService:** HTTP routes and cancel flows call `JobService`. Services that enqueue background work (`DocumentService`, `PipelineService` in [`account/modules/statements/`](../account/modules/statements/)) call `JobRunnerService.submit`. Bootstrap wires `recoverJobs()` and `shutdown()` on the runner at API startup/teardown. This is not Argus Kronos — Kronos runs system-scheduled Lambda jobs; NetworthDB jobs are user-scoped, conflict-keyed, and cancellable (see ADR-005).

## Root layout

| Path                                                                         | Contents                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| [`entities/job.ts`](entities/job.ts)                                         | `Job` aggregate with lifecycle transitions    |
| [`embedded/scope/types.ts`](embedded/scope/types.ts)                         | `JobScope` type; `emptyJobScope`              |
| [`embedded/scope/rules.ts`](embedded/scope/rules.ts)                           | `createJobScope`, `jobScopeFromJson`, `jobScopeToCanonicalJson` |
| [`repositories/job-repository.ts`](repositories/job-repository.ts)           | Job persistence port                          |
| [`services/job-service.ts`](services/job-service.ts)                         | List/get/cancel HTTP use cases                |
| [`services/job-runner-service.ts`](services/job-runner-service.ts)                           | Async worker pool + cooperative cancel        |

Statement file upload, download, metadata, and sync enqueue live under [`account/modules/statements/`](../account/modules/statements/).
