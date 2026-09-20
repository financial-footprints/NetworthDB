import { describe, expect, test } from "bun:test";
import { validateCardCatalogs } from "@statements/cards/validate";

describe("card catalog registry coverage", () => {
  test("every listHandlers key has a valid catalog.json", async () => {
    const errors = await validateCardCatalogs();
    expect(errors).toEqual([]);
  });
});
