import { describe, expect, test } from "bun:test";
import { maskAccountDateInput } from "@web/utils/time";

describe("maskAccountDateInput", () => {
  test("inserts dashes as digits are typed", () => {
    expect(maskAccountDateInput("1")).toBe("1");
    expect(maskAccountDateInput("15")).toBe("15");
    expect(maskAccountDateInput("150")).toBe("15-0");
    expect(maskAccountDateInput("1503")).toBe("15-03");
    expect(maskAccountDateInput("15032")).toBe("15-03-2");
    expect(maskAccountDateInput("15032024")).toBe("15-03-2024");
  });

  test("strips non-digits and caps at eight digits", () => {
    expect(maskAccountDateInput("15-03-2024")).toBe("15-03-2024");
    expect(maskAccountDateInput("15/03/202499")).toBe("15-03-2024");
    expect(maskAccountDateInput("ab15cd03ef2024gh")).toBe("15-03-2024");
  });

  test("handles backspace through dashes", () => {
    expect(maskAccountDateInput("15-03-202")).toBe("15-03-202");
    expect(maskAccountDateInput("15-03-")).toBe("15-03");
    expect(maskAccountDateInput("15-")).toBe("15");
  });
});
