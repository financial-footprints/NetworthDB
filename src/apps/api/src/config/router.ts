import type { AuthEnv } from "@api/config/hono-env";
import {
  createRoute,
  OpenAPIHono,
  type RouteConfig,
  type RouteHandler,
  type RouteHook,
} from "@hono/zod-openapi";
import { requireSession } from "@ndb/middleware";
import type { ApiErrorResponse } from "@ndb/platform";
import { apiErrorResponseSchema } from "@ndb/platform";
import type { Env, MiddlewareHandler, Schema } from "hono";

const errorBody = {
  content: { "application/json": { schema: apiErrorResponseSchema } },
} as const;

export const errorResponses = {
  400: { ...errorBody, description: "Bad Request" },
  401: { ...errorBody, description: "Unauthorized" },
  403: { ...errorBody, description: "Forbidden" },
  404: { ...errorBody, description: "Not Found" },
  409: { ...errorBody, description: "Conflict" },
  429: { ...errorBody, description: "Too Many Requests" },
  500: { ...errorBody, description: "Internal Server Error" },
} as const;

function createApiValidationHook<E extends Env>(): RouteHook<RouteConfig, E> {
  return (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.length > 0 ? issue.path.join(".") : undefined;
      const response: ApiErrorResponse = {
        error: issue.message,
        code: "invalid_input",
        ...(field ? { field } : {}),
      };

      return c.json(response, 400);
    }
  };
}

export class ApiRouter<
  E extends Env = Env,
  S extends Schema = Record<string, never>,
  BasePath extends string = "/",
> extends OpenAPIHono<E, S, BasePath> {
  private readonly routeMiddleware: MiddlewareHandler<E>[] = [];

  constructor() {
    super({ defaultHook: createApiValidationHook<E>() });
  }

  applyRouteMiddleware(...middleware: MiddlewareHandler<E>[]): this {
    this.routeMiddleware.push(...middleware);
    return this;
  }

  endpoint<R extends RouteConfig>(
    routeConfig: R,
    handler: RouteHandler<R, E>,
    hook?: RouteHook<R, E>
  ): this;
  endpoint(
    routeConfig: RouteConfig,
    handler: RouteHandler<RouteConfig, E>,
    hook?: RouteHook<RouteConfig, E>
  ): this {
    const perRouteMiddleware = routeConfig.middleware
      ? Array.isArray(routeConfig.middleware)
        ? routeConfig.middleware
        : [routeConfig.middleware]
      : [];
    const middleware = [...this.routeMiddleware, ...perRouteMiddleware];

    this.openapi(
      createRoute({
        ...routeConfig,
        middleware: middleware as RouteConfig["middleware"],
      }),
      handler,
      hook as Parameters<OpenAPIHono<E, S, BasePath>["openapi"]>[2]
    );
    return this;
  }
}

export function createSessionRouter(): ApiRouter<AuthEnv> {
  const router = new ApiRouter<AuthEnv>();
  router.applyRouteMiddleware(requireSession<AuthEnv>());
  return router;
}
