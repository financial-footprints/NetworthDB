import { describe, expect, test } from "bun:test";
import { path, routes } from "@web/router/routes";

describe("rules information architecture routes", () => {
  test("path helper points at rules URL", () => {
    expect(path.rules.list).toBe("/rules");
    expect(path.rules.create).toBe("/rules/new");
    expect(path.rules.details("abc")).toBe("/rules/abc");
  });

  test("route is registered and shown in sidebar", () => {
    const routePaths = routes.map((route) => route.path);
    expect(routePaths).toContain(path.rules.list);

    const rulesRoutes = routes.filter((route) => route.label === "Rules" && route.sidebar?.show);
    expect(rulesRoutes).toHaveLength(1);
    expect(rulesRoutes[0]?.app?.public).toBeUndefined();
  });
});
