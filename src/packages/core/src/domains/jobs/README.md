# Jobs Domain

Job queue bounded context: persist user-scoped background work, run it in-process, and expose list/get/cancel.

## Vocabulary

| Term | Meaning |
| ---- | ------- |
| **Job** | Persisted background-work record (status, stage, scope, output) |
| **JobScope** | Account/year key for conflict detection (`accountId`, `financialYear`) |
| **JobStage** | Kind of work: `upload`, `sync`, `backup_export`, `backup_import`, `rules_apply` |

Statement pipeline processing lives under [`account/statements/`](../account/statements/). `PipelineRun` is built per job callback from the account, sources, and job scope.

## Service Layout

| Service | Role |
| ------- | ---- |
| [`JobService`](services/job-service.ts) | HTTP use cases: list, get, cancel (AAL2 step-up) |
| [`JobRunnerService`](services/job-runner-service.ts) | In-process worker pool, cooperative cancel, orphan recover on boot |

**JobService vs JobRunnerService:** HTTP routes and cancel flows call `JobService`. Services that enqueue background work (`StatementService`, `PipelineService`, `BackupService`) call `JobRunnerService.submit`. Bootstrap wires `recoverJobs()`, hourly `purgeExpiredExports` / `purgeExpiredLogs`, and `shutdown()` on the runner at API startup/teardown.

## Root Layout

| Path | Contents |
| ---- | -------- |
| [`entities/job.ts`](entities/job.ts) | `Job` aggregate with lifecycle transitions |
| [`embedded/scope.ts`](embedded/scope.ts) | `JobScope` type, JSON helpers, and canonical serialization |
| [`embedded/output.ts`](embedded/output.ts) | Pipeline warning output helpers |
| [`repositories/job-repository.ts`](repositories/job-repository.ts) | Job persistence port |
| [`services/job-service.ts`](services/job-service.ts) | List/get/cancel HTTP use cases |
| [`services/job-runner-service.ts`](services/job-runner-service.ts) | Async worker pool + cooperative cancel |

Statement file upload, download, metadata, and sync enqueue live under [`account/statements/`](../account/statements/).
