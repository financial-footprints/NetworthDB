import { describe, expect, test } from "bun:test";
import { getRequestLogContext, runWithRequestContext, setRequestActorId } from "@ndb/logger";

describe("request context", () => {
  test("runWithRequestContext exposes rayId in log context", async () => {
    await runWithRequestContext("ray-123", async () => {
      expect(getRequestLogContext()).toEqual({ rayId: "ray-123" });
    });
  });

  test("setRequestActorId adds actorId to log context", async () => {
    await runWithRequestContext("ray-456", async () => {
      setRequestActorId("user-1");
      expect(getRequestLogContext()).toEqual({ rayId: "ray-456", actorId: "user-1" });
    });
  });

  test("getRequestLogContext is empty outside scope", () => {
    expect(getRequestLogContext()).toEqual({});
  });
});
