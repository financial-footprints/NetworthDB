import { describe, expect, test } from "bun:test";
import {
  chooseSeriesBucket,
  classifyDashboardMovement,
  startOfIsoWeekUtc,
} from "@core/domains/account/dashboard/helpers";

describe("dashboard helpers", () => {
  test("chooseSeriesBucket", () => {
    expect(chooseSeriesBucket("2024-06-01", "2024-06-30")).toBe("day");
    expect(chooseSeriesBucket("2024-01-01", "2024-12-31")).toBe("week");
    expect(chooseSeriesBucket("2020-01-01", "2021-02-05")).toBe("month");
  });

  test("startOfIsoWeekUtc", () => {
    expect(startOfIsoWeekUtc("2024-06-05")).toBe("2024-06-03");
  });

  test("classifyDashboardMovement", () => {
    expect(classifyDashboardMovement("bank", "expense")).toBe("spend");
    expect(classifyDashboardMovement("revenue", "bank")).toBe("income");
    expect(classifyDashboardMovement("bank", "credit_card")).toBe("transfer");
    expect(classifyDashboardMovement("unknown", "unknown")).toBe("other");
  });
});
