import { describe, expect, test } from "bun:test";
import { errorHandler } from "@middleware/http/error";
import {
  BusinessRuleError,
  ConflictError,
  EntityNotFoundError,
  ForbiddenError,
  staleUpdateError,
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

describe("errorHandler", () => {
  test("maps UnauthorizedError to 401", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw new UnauthorizedError("Session is invalid or expired.");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      details: { reason: "Session is invalid or expired." },
    });
  });

  test("maps ForbiddenError to 403", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw new ForbiddenError("Forbidden");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("maps ValidationError to 400", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw new ValidationError("Username is required.", { field: "username" });
    });

    const response = await app.request("/test");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Username is required.",
      code: "VALIDATION_ERROR",
      field: "username",
    });
  });

  test("maps ConflictError to 409", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw new ConflictError("Username is already taken.");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "CONFLICT",
    });
  });

  test("maps EntityNotFoundError to 404", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw new EntityNotFoundError("User", "missing");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "ENTITY_NOT_FOUND",
    });
  });

  test("maps TooManyRequestsError to 429", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw new TooManyRequestsError("Too many requests.");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: "Too many requests.",
      code: "TOO_MANY_REQUESTS",
    });
  });

  test("maps BusinessRuleError to 422", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw new BusinessRuleError("Keep one key.", "VAULT_LAST_SLOT");
    });

    const response = await app.request("/test");
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "VAULT_LAST_SLOT",
    });
  });

  test("maps stale update to 409", async () => {
    const app = new Hono();
    app.onError(errorHandler(createTestLogger()));
    app.get("/test", () => {
      throw staleUpdateError(1, 2);
    });

    const response = await app.request("/test");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "STALE_UPDATE",
    });
  });
});
