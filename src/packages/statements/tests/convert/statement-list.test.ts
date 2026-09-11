import { describe, expect, test } from "bun:test";
import { bank } from "@statements/convert/bank.ts";
import { statementList } from "@statements/convert/statement-list.ts";

describe("bank.toDomain", () => {
  test("normalizes missing variant to null", () => {
    const result = bank.toDomain({
      key: "hdfc-default",
      bank: "hdfc",
      accountType: "credit_card",
    });

    expect(result.variant).toBeNull();
  });

  test("preserves variant when present", () => {
    const result = bank.toDomain({
      key: "hdfc-regalia",
      bank: "hdfc",
      variant: "regalia",
      accountType: "credit_card",
    });

    expect(result.variant).toBe("regalia");
  });
});

describe("statementList.toDomain", () => {
  test("maps native statement kinds to core string literals", () => {
    const result = statementList.toDomain({
      available: true,
      statementCount: 2,
      formats: ["pdf"],
      coverage: {
        segments: [],
        gaps: [],
        months: [],
        periodCount: 0,
      },
      statements: [
        {
          accountId: "acc-1",
          kind: 0,
          period: "2024-01",
          statementDate: "2024-01-31",
          formats: ["pdf"],
        },
        {
          accountId: "acc-1",
          kind: 1,
          period: "2023-24",
          statementDate: "2024-03-31",
          formats: ["pdf"],
        },
      ],
      balanceGaps: [],
    });

    expect(result.statements[0]?.kind).toBe("monthly");
    expect(result.statements[1]?.kind).toBe("annual");
  });

  test("normalizes missing period bounds to null", () => {
    const result = statementList.toDomain({
      available: true,
      statementCount: 1,
      formats: ["pdf"],
      coverage: {
        segments: [],
        gaps: [],
        months: [],
        periodCount: 0,
      },
      statements: [
        {
          accountId: "acc-1",
          kind: 0,
          period: "2024-01",
          statementDate: "2024-01-31",
          formats: ["pdf"],
        },
      ],
      balanceGaps: [],
    });

    expect(result.statements[0]?.periodStart).toBeNull();
    expect(result.statements[0]?.periodEnd).toBeNull();
  });

  test("preserves period bounds when present", () => {
    const result = statementList.toDomain({
      available: true,
      statementCount: 1,
      formats: ["pdf"],
      coverage: {
        segments: [],
        gaps: [],
        months: [],
        periodCount: 0,
      },
      statements: [
        {
          accountId: "acc-1",
          kind: 0,
          period: "2024-01",
          statementDate: "2024-01-31",
          formats: ["pdf"],
          periodStart: "2024-01-01",
          periodEnd: "2024-01-31",
        },
      ],
      balanceGaps: [],
    });

    expect(result.statements[0]?.periodStart).toBe("2024-01-01");
    expect(result.statements[0]?.periodEnd).toBe("2024-01-31");
  });
});
