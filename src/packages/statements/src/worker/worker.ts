import { parentPort, workerData } from "node:worker_threads";
import type { StatementPipelineResult } from "@ndb/core";
import {
  processDeleteJob,
  processPipelineJob,
  processUploadJob,
} from "@statements/pipeline/jobs/process";
import { deserializePipelineRun } from "@statements/pipeline/jobs/serde";
import type { Reply, Request, RuntimeData } from "@statements/worker/wire";

const config = workerData as RuntimeData;
const cancelled = new Set<string>();

function isCancelled(jobId?: string): () => boolean {
  if (!jobId) {
    return () => false;
  }
  return () => cancelled.has(jobId);
}

async function exec(
  request: Extract<Request, { type: "run" }>,
  onLogLine?: (line: string) => void
): Promise<StatementPipelineResult> {
  const pipeline = deserializePipelineRun(request.payload.pipeline);
  const shouldCancel = isCancelled(request.jobId);

  switch (request.payload.method) {
    case "processPipeline":
      return processPipelineJob(config, pipeline, shouldCancel, onLogLine);
    case "processUpload":
      return processUploadJob(config, pipeline, shouldCancel, onLogLine);
    case "deleteAccountStatements":
      return processDeleteJob(config, pipeline, shouldCancel, onLogLine);
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

  void (async () => {
    try {
      const pipeline = deserializePipelineRun(message.payload.pipeline);
      const onLogLine = pipeline.trace
        ? (line: string) => {
            parentPort?.postMessage({
              type: "progress",
              taskId: message.taskId,
              line,
            } satisfies Reply);
          }
        : undefined;
      const result = await exec(message, onLogLine);
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
  })();
});

parentPort?.postMessage({ type: "ready" } satisfies Reply);
