import type { AuthEnv } from "@api/config/hono-env";
import { jsonMedia } from "@api/config/http";
import {
  createRoute,
  OpenAPIHono,
  type RouteConfig,
  type RouteHandler,
  type RouteHook,
} from "@hono/zod-openapi";
import type { ApiErrorResponse } from "@ndb/platform";
import { apiErrorResponseSchema } from "@ndb/platform";
import type { Env, MiddlewareHandler, Schema } from "hono";

const errorBodyContent = jsonMedia(apiErrorResponseSchema);

export const errorResponses = {
  400: { content: errorBodyContent, description: "Bad Request" },
  401: { content: errorBodyContent, description: "Unauthorized" },
  403: { content: errorBodyContent, description: "Forbidden" },
  404: { content: errorBodyContent, description: "Not Found" },
  409: { content: errorBodyContent, description: "Conflict" },
  422: { content: errorBodyContent, description: "Unprocessable Entity" },
  429: { content: errorBodyContent, description: "Too Many Requests" },
  500: { content: errorBodyContent, description: "Internal Server Error" },
};

function createApiValidationHook<E extends Env>(): RouteHook<RouteConfig, E> {
  return (result, c): Response | undefined => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.length > 0 ? issue.path.join(".") : undefined;
      const response: ApiErrorResponse = {
        error: issue.message,
        code: "VALIDATION_ERROR",
        ...(field ? { field } : {}),
      };

      return c.json(response, 400);
    }
    return undefined;
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

  endpoint<R extends RouteConfig>(routeConfig: R, handler: RouteHandler<R, E>): this;
  endpoint(routeConfig: RouteConfig, handler: RouteHandler<RouteConfig, E>): this {
    const perRouteMiddleware = routeConfig.middleware
      ? Array.isArray(routeConfig.middleware)
        ? routeConfig.middleware
        : [routeConfig.middleware]
      : [];
    const middleware = [...this.routeMiddleware, ...perRouteMiddleware];

    const route = createRoute({
      ...routeConfig,
      middleware: middleware as RouteConfig["middleware"],
    });

    this.openapi(route, handler);
    return this;
  }
}

export function createSessionRouter(): ApiRouter<AuthEnv> {
  return new ApiRouter<AuthEnv>();
}
