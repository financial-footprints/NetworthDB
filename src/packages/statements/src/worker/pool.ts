import { Worker } from "node:worker_threads";
import type { StatementPipelineResult } from "@ndb/core";
import type { StatementsRuntimeConfig } from "@statements/api.ts";
import { statementPipelineResult } from "@statements/convert/statement-pipeline-result.ts";
import type { Payload, Reply, Request, RuntimeData } from "@statements/worker/wire.ts";

type Task = {
  taskId: string;
  jobId?: string;
  payload: Payload;
  resolve: (result: StatementPipelineResult) => void;
  reject: (error: Error) => void;
};

type Slot = {
  worker: Worker;
  busy: boolean;
  taskId?: string;
};

export type Config = {
  threads: number;
  runtime?: StatementsRuntimeConfig;
};

export class Pool {
  private readonly slots: Slot[] = [];
  private readonly queue: Task[] = [];
  private readonly active = new Map<string, Task>();
  private readonly cancelled = new Set<string>();
  private readonly ready = new Set<Worker>();
  private nextId = 0;
  private closing = false;

  constructor(config: Config) {
    const count = Math.max(1, config.threads);
    const runtime: RuntimeData = config.runtime ?? {};

    for (let index = 0; index < count; index += 1) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        workerData: runtime,
      });

      const slot: Slot = { worker, busy: false };
      this.slots.push(slot);

      worker.on("message", (message: Reply) => {
        this.onMessage(slot, message);
      });

      worker.on("error", (error: unknown) => {
        this.onFail(slot, toError(error));
      });

      worker.on("exit", (code) => {
        if (!this.closing && code !== 0) {
          this.onFail(slot, new Error(`statements worker exited with code ${code}`));
        }
      });
    }
  }

  run(payload: Payload, jobId?: string): Promise<StatementPipelineResult> {
    if (this.closing) {
      return Promise.reject(new Error("statements.pool.shutting-down"));
    }

    if (jobId && this.cancelled.has(jobId)) {
      return Promise.resolve(cancelled());
    }

    return new Promise((resolve, reject) => {
      const taskId = `task-${this.nextId++}`;
      this.queue.push({
        taskId,
        jobId,
        payload,
        resolve,
        reject,
      });
      this.dispatch();
    });
  }

  cancel(jobId: string): void {
    this.cancelled.add(jobId);

    const pending: Task[] = [];
    for (const task of this.queue) {
      if (task.jobId === jobId) {
        task.resolve(cancelled());
      } else {
        pending.push(task);
      }
    }
    this.queue.splice(0, this.queue.length, ...pending);

    for (const slot of this.slots) {
      const task = slot.taskId !== undefined ? this.active.get(slot.taskId) : undefined;
      if (task?.jobId === jobId) {
        const request: Request = { type: "cancel", jobId };
        slot.worker.postMessage(request);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.closing = true;

    for (const task of this.queue.splice(0)) {
      task.reject(new Error("statements.pool.shutting-down"));
    }

    for (const task of this.active.values()) {
      task.reject(new Error("statements.pool.shutting-down"));
    }
    this.active.clear();

    await Promise.all(this.slots.map(({ worker }) => worker.terminate()));
    this.slots.length = 0;
    this.ready.clear();
  }

  private dispatch(): void {
    while (this.queue.length > 0) {
      const slot = this.slots.find((entry) => !entry.busy && this.ready.has(entry.worker));
      if (!slot) {
        return;
      }

      const task = this.queue.shift();
      if (!task) {
        return;
      }

      if (task.jobId && this.cancelled.has(task.jobId)) {
        task.resolve(cancelled());
        continue;
      }

      slot.busy = true;
      slot.taskId = task.taskId;
      this.active.set(task.taskId, task);

      const request: Request = {
        type: "run",
        taskId: task.taskId,
        jobId: task.jobId,
        payload: task.payload,
      };
      slot.worker.postMessage(request);
    }
  }

  private onMessage(slot: Slot, message: Reply): void {
    if (message.type === "ready") {
      this.ready.add(slot.worker);
      this.dispatch();
      return;
    }

    if (message.type === "error") {
      this.finish(slot, message.taskId, undefined, new Error(message.message));
      return;
    }

    if (message.type === "done") {
      this.finish(slot, message.taskId, statementPipelineResult.toDomain(message.result));
    }
  }

  private onFail(slot: Slot, error: Error): void {
    if (slot.taskId) {
      this.finish(slot, slot.taskId, undefined, error);
      return;
    }

    slot.busy = false;
    slot.taskId = undefined;
    this.dispatch();
  }

  private finish(
    slot: Slot,
    taskId: string,
    result?: StatementPipelineResult,
    error?: Error
  ): void {
    const task = this.active.get(taskId);
    this.active.delete(taskId);

    slot.busy = false;
    slot.taskId = undefined;

    if (task) {
      if (error) {
        task.reject(error);
      } else if (result) {
        task.resolve(result);
      } else {
        task.reject(new Error("statements.pool.missing-result"));
      }
    }

    this.dispatch();
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function cancelled(): StatementPipelineResult {
  return {
    ok: false,
    reason: "cancelled by user",
    warnings: [],
  };
}

export function createPool(config: Config): Pool {
  return new Pool(config);
}
