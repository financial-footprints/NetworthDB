import { describe, expect, test } from "bun:test";
import { path, routes } from "@web/router/routes";

describe("public route information architecture", () => {
  test("login and not-found are public", () => {
    const login = routes.find((route) => route.path === path.login);
    const notFound = routes.find((route) => route.path === path.notFound);
    expect(login?.app?.public).toBe(true);
    expect(notFound?.app?.public).toBe(true);
  });

  test("home is not public", () => {
    const home = routes.find((route) => route.path === path.home);
    expect(home?.app?.public).not.toBe(true);
  });
});
