import { describe, expect, test } from "bun:test";
import { path, routes } from "@web/router/routes";

describe("taxonomy information architecture routes", () => {
  test("path helpers point at taxonomy URLs", () => {
    expect(path.categories.list).toBe("/categories");
    expect(path.tags.list).toBe("/tags");
  });

  test("routes are registered and shown in sidebar", () => {
    const routePaths = routes.map((route) => route.path);
    expect(routePaths).toContain(path.categories.list);
    expect(routePaths).toContain(path.tags.list);

    const categories = routes.filter(
      (route) => route.label === "Categories" && route.sidebar?.show
    );
    const tags = routes.filter((route) => route.label === "Tags" && route.sidebar?.show);
    expect(categories).toHaveLength(1);
    expect(tags).toHaveLength(1);
    expect(categories[0]?.sidebar?.group).toEqual(tags[0]?.sidebar?.group);
    expect(categories[0]?.sidebar?.group?.label).toBe("Organize");
    expect(categories[0]?.app?.public).toBeUndefined();
    expect(tags[0]?.app?.public).toBeUndefined();
  });
});
