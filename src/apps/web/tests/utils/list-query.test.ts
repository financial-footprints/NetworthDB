import { describe, expect, test } from "bun:test";
import { toAccountListQuery } from "@web/routes/accounts/list/query";
import { encodeSortParamUpdates, parseSortParam, patchUrlParams } from "@web/utils/list";

describe("list query params", () => {
  test("patchUrlParams deletes on null and empty", () => {
    const current = new URLSearchParams("q=foo&page=2");
    const next = patchUrlParams(current, { q: null, page: "" });
    expect(next.get("q")).toBeNull();
    expect(next.get("page")).toBeNull();
  });

  test("patchUrlParams sets values", () => {
    const next = patchUrlParams(new URLSearchParams(), { q: "hdfc", sort: "label" });
    expect(next.get("q")).toBe("hdfc");
    expect(next.get("sort")).toBe("label");
  });
});

describe("list sort params", () => {
  const fieldToUrl = {
    label: "label",
    accountType: "accountType",
    currentBalance: "currentBalance",
  } as const;

  test("parseSortParam reads sort and direction", () => {
    const params = new URLSearchParams("sort=currentBalance&direction=desc");
    const sort = parseSortParam(params, fieldToUrl);
    expect(sort).toEqual({ field: "currentBalance", direction: "desc" });
  });

  test("encodeSortParamUpdates clears when null", () => {
    expect(encodeSortParamUpdates(null, fieldToUrl)).toEqual({
      sort: null,
      direction: null,
    });
  });
});

describe("account list status filter", () => {
  test("omitted status is treated as open in query mapping", () => {
    const query = toAccountListQuery(
      "",
      { account_type: "", status: "" },
      {
        field: "label",
        direction: "asc",
      }
    );
    expect(query.status).toBe("open");
  });
});
