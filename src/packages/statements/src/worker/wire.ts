import type { StatementPipelineResult } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import type { PipelineSnapshot } from "@statements/pipeline/jobs/serde";

export type RuntimeData = StatementsEngineConfig;

export type Payload =
  | {
      method: "processPipeline";
      pipeline: PipelineSnapshot;
    }
  | {
      method: "processUpload";
      pipeline: PipelineSnapshot;
    }
  | {
      method: "deleteAccountStatements";
      pipeline: PipelineSnapshot;
    };

export type Request =
  | {
      type: "run";
      taskId: string;
      jobId?: string;
      payload: Payload;
    }
  | {
      type: "cancel";
      jobId: string;
    };

export type Reply =
  | { type: "ready" }
  | { type: "progress"; taskId: string; line: string }
  | { type: "done"; taskId: string; result: StatementPipelineResult }
  | { type: "error"; taskId: string; message: string };
