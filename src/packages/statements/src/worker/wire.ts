import type { StatementsRuntimeConfig } from "@statements/api.ts";
import type { ProcessResult, StatementsRun } from "../../native.d.ts";

export type RuntimeData = StatementsRuntimeConfig;

export type Payload =
  | {
      method: "processPipeline";
      run: StatementsRun;
      dataKey: Buffer | null;
      debugTrace?: boolean;
    }
  | {
      method: "processUpload";
      run: StatementsRun;
      accountId: string;
      format: string;
      statementDate: string | null | undefined;
      dataKey: Buffer | null;
      debugTrace?: boolean;
    }
  | {
      method: "deleteAccountStatements";
      run: StatementsRun;
      accountId: string;
      dataKey: Buffer | null;
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
  | { type: "done"; taskId: string; result: ProcessResult }
  | { type: "error"; taskId: string; message: string };
