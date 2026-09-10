import type { ApiServices } from "@ndb/bootstrap";
import { API } from "@ndb/platform";
import { Hono } from "hono";

export function createHealthRoutes(services: ApiServices): Hono {
  const routes = new Hono();

  routes.get(API.health.get, async (c) => {
    const health = await services.health();

    return c.json({
      data: {
        ok: health.ok,
      },
      errors: [],
    });
  });

  return routes;
}
