import { describe, expect, test } from "bun:test";
import { onError } from "@middleware/http/error";
import {
  ConflictError,
  EntityNotFoundError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "@ndb/core";
import { Hono } from "hono";

function createTestLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => createTestLogger(),
  };
}

describe("onError", () => {
  test("maps UnauthorizedError to 401", async () => {
    const app = new Hono();
    app.onError(onError(createTestLogger()));
    app.get("/test", () => {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
      code: "unauthorized",
      details: { reason: "core.auth.session.unauthorized.invalid-or-expired" },
    });
  });

  test("maps ForbiddenError to 403", async () => {
    const app = new Hono();
    app.onError(onError(createTestLogger()));
    app.get("/test", () => {
      throw new ForbiddenError("core.user.authorization.forbidden.insufficient-admin");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(403);
  });

  test("maps ValidationError to 400", async () => {
    const app = new Hono();
    app.onError(onError(createTestLogger()));
    app.get("/test", () => {
      throw new ValidationError("api.auth.login.invalid.username-required", { field: "username" });
    });

    const response = await app.request("/test");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "api.auth.login.invalid.username-required",
      code: "invalid_input",
      field: "username",
    });
  });

  test("maps ConflictError to 409", async () => {
    const app = new Hono();
    app.onError(onError(createTestLogger()));
    app.get("/test", () => {
      throw new ConflictError("core.user.username.conflict.taken");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(409);
  });

  test("maps EntityNotFoundError to 404", async () => {
    const app = new Hono();
    app.onError(onError(createTestLogger()));
    app.get("/test", () => {
      throw new EntityNotFoundError("core.user.find.not-found", {
        entityName: "User",
        id: "missing",
      });
    });

    const response = await app.request("/test");
    expect(response.status).toBe(404);
  });

  test("maps TooManyRequestsError to 429", async () => {
    const app = new Hono();
    app.onError(onError(createTestLogger()));
    app.get("/test", () => {
      throw new TooManyRequestsError("middleware.auth.ratelimit.error.too-many-requests");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: "middleware.auth.ratelimit.error.too-many-requests",
      code: "too_many_requests",
    });
  });
});
