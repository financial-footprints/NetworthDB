import { describe, expect, test } from "bun:test";
import { path, routes } from "@web/router/routes";

describe("credit cards information architecture routes", () => {
  test("hub path is registered with sidebar entry", () => {
    expect(path.creditCards.hub).toBe("/credit-cards");
    const hub = routes.find((route) => route.path === path.creditCards.hub);
    expect(hub?.label).toBe("Card Benefits");
    expect(hub?.sidebar?.show).toBe(true);
  });

  test("per-card detail route is not registered", () => {
    const legacy = routes.find((route) => route.path === "/credit-cards/:bank/:variant");
    expect(legacy).toBeUndefined();
  });
});
