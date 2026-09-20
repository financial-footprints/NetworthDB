import { AsyncLocalStorage } from "node:async_hooks";
import type { LogContext } from "@logger/types";

type RequestContext = {
  rayId: string;
  actorId?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export async function runWithRequestContext(rayId: string, fn: () => Promise<void>): Promise<void> {
  await requestContextStorage.run({ rayId }, fn);
}

export function setRequestActorId(actorId: string): void {
  const store = requestContextStorage.getStore();
  if (store) {
    store.actorId = actorId;
  }
}

export function getRequestLogContext(): LogContext {
  const store = requestContextStorage.getStore();
  if (!store) {
    return {};
  }

  return {
    rayId: store.rayId,
    ...(store.actorId ? { actorId: store.actorId } : {}),
  };
}
