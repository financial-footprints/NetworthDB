import { describe, expect, test } from "bun:test";
import { invertExcluded } from "@web/utils/credit-cards/query";

const ALL = ["a", "b", "c"] as const;

describe("invertExcluded", () => {
  test("all visible becomes all excluded", () => {
    expect(invertExcluded(ALL, new Set())).toEqual(["a", "b", "c"]);
  });

  test("all hidden becomes none excluded", () => {
    expect(invertExcluded(ALL, new Set(ALL))).toEqual([]);
  });

  test("partial selection swaps visible and hidden", () => {
    expect(invertExcluded(ALL, new Set(["b"]))).toEqual(["a", "c"]);
  });
});
