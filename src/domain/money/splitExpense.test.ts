import { describe, expect, it } from "vitest";
import { splitExpense } from "./splitExpense";
import type { LedgerExpense } from "./types";
import { MoneyLedgerError } from "./validateLedger";

const context = {
  baseCurrency: "KRW" as const,
  members: [
    { id: "me", name: "나" },
    { id: "minjun", name: "민준" },
    { id: "seoyeon", name: "서연" },
    { id: "doyun", name: "도윤" },
  ],
};

const ramen: LedgerExpense = {
  id: "ramen",
  amount: 3_600,
  currency: "JPY",
  rateToBase: "9.124",
  paidBy: { kind: "fund" },
  split: { kind: "even", memberIds: ["me", "minjun", "seoyeon", "doyun"] },
};

describe("splitExpense", () => {
  it("4명 균등이면 1인당 ¥900이고 원화는 남는 1원을 앞사람부터 준다", () => {
    expect(splitExpense(ramen, context)).toEqual([
      { memberId: "me", amount: 900, baseAmount: 8_212 },
      { memberId: "minjun", amount: 900, baseAmount: 8_212 },
      { memberId: "seoyeon", amount: 900, baseAmount: 8_211 },
      { memberId: "doyun", amount: 900, baseAmount: 8_211 },
    ]);
  });

  it("사람별 금액은 그대로 두고 원화는 그 비율로 나눈다", () => {
    const custom: LedgerExpense = {
      ...ramen,
      split: {
        kind: "custom",
        shares: [
          { memberId: "me", amount: 1_200 },
          { memberId: "minjun", amount: 800 },
          { memberId: "seoyeon", amount: 800 },
          { memberId: "doyun", amount: 800 },
        ],
      },
    };

    expect(
      splitExpense(custom, context).map(({ amount, baseAmount }) => [amount, baseAmount]),
    ).toEqual([
      [1_200, 10_949],
      [800, 7_299],
      [800, 7_299],
      [800, 7_299],
    ]);
  });

  it("고른 순서와 상관없이 동행자 목록 순서로 돌려준다", () => {
    const pair: LedgerExpense = {
      ...ramen,
      amount: 5_000,
      split: { kind: "even", memberIds: ["minjun", "me"] },
    };

    expect(splitExpense(pair, context)).toEqual([
      { memberId: "me", amount: 2_500, baseAmount: 22_810 },
      { memberId: "minjun", amount: 2_500, baseAmount: 22_810 },
    ]);
  });

  it("검사에 걸리는 지출은 나누지 않는다", () => {
    const broken: LedgerExpense = { ...ramen, split: { kind: "even", memberIds: [] } };
    expect(() => splitExpense(broken, context)).toThrow(MoneyLedgerError);
  });
});
