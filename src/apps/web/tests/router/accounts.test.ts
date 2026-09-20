import { describe, expect, test } from "bun:test";
import { path, routes } from "@web/router/routes";

describe("accounts information architecture routes", () => {
  test("path helpers point at unified accounts URLs", () => {
    expect(path.accounts.list).toBe("/accounts");
    expect(path.accounts.details()).toBe("/accounts/:accountId");
    expect(path.accounts.details("acct-1")).toBe("/accounts/acct-1");
    expect(path.accounts.statements("acct-1")).toBe("/accounts/acct-1/statements");
  });

  test("legacy statement list and detail paths are not registered", () => {
    const routePaths = routes.map((route) => route.path);
    expect(routePaths).not.toContain("/statements/bank-account");
    expect(routePaths).not.toContain("/statements/credit-card");
    expect(routePaths).not.toContain("/statements/bank-account/:accountId");
    expect(routePaths).not.toContain("/statements/credit-card/:accountId");
  });

  test("sidebar exposes a single Accounts entry", () => {
    const sidebarAccounts = routes.filter(
      (route) => route.label === "Accounts" && route.sidebar?.show
    );
    expect(sidebarAccounts).toHaveLength(1);
    expect(sidebarAccounts[0]?.path).toBe(path.accounts.list);
  });

  test("public not-found route is registered", () => {
    const notFound = routes.find((route) => route.path === path.notFound);
    expect(notFound?.app?.public).toBe(true);
  });
});
