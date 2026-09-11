import { createRequire } from "node:module";
import { parentPort, workerData } from "node:worker_threads";
import type { Reply, Request, RuntimeData } from "@statements/worker/wire.ts";
import type * as Native from "../../native.d.ts";
import type { ProcessResult } from "../../native.d.ts";

const require = createRequire(import.meta.url);
const native = require("../../statements.node") as typeof Native;

const runtime = workerData as RuntimeData;
native.initStatementsRuntime(runtime);

const cancelled = new Set<string>();

function isCancelled(jobId?: string): () => boolean {
  if (!jobId) {
    return () => false;
  }

  return () => cancelled.has(jobId);
}

function exec(request: Extract<Request, { type: "run" }>): ProcessResult {
  const cancel = isCancelled(request.jobId);

  switch (request.payload.method) {
    case "processPipeline":
      return native.processPipeline(
        request.payload.run,
        request.payload.dataKey,
        request.payload.debugTrace ?? false,
        cancel
      );
    case "processUpload":
      return native.processUpload(
        request.payload.run,
        {
          accountId: request.payload.accountId,
          format: request.payload.format,
          statementDate: request.payload.statementDate ?? null,
        },
        request.payload.dataKey,
        request.payload.debugTrace ?? false,
        cancel
      );
    case "deleteAccountStatements":
      return native.deleteAccountStatements(
        request.payload.run,
        request.payload.accountId,
        request.payload.dataKey
      );
  }
}

parentPort?.on("message", (message: Request) => {
  if (message.type === "cancel") {
    cancelled.add(message.jobId);
    return;
  }

  if (message.type !== "run") {
    return;
  }

  try {
    const result = exec(message);
    const response: Reply = {
      type: "done",
      taskId: message.taskId,
      result,
    };
    parentPort?.postMessage(response);
  } catch (error) {
    const response: Reply = {
      type: "error",
      taskId: message.taskId,
      message: error instanceof Error ? error.message : String(error),
    };
    parentPort?.postMessage(response);
  }
});

parentPort?.postMessage({ type: "ready" } satisfies Reply);
