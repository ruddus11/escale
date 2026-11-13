import { describe, expect, it } from "vitest";
import { summarizeLedger } from "./summarizeLedger";
import type { FundContribution, LedgerExpense, MoneyLedger } from "./types";
import { MoneyLedgerError } from "./validateLedger";

const members = [
  { id: "me", name: "나" },
  { id: "minjun", name: "민준" },
  { id: "seoyeon", name: "서연" },
  { id: "doyun", name: "도윤" },
];
const everyone = members.map((member) => member.id);

function ledger(overrides: Partial<MoneyLedger> = {}): MoneyLedger {
  return {
    baseCurrency: "KRW",
    members,
    fundHolderId: "me",
    expenses: [],
    fundContributions: [],
    payments: [],
    ...overrides,
  };
}

function wonExpense(id: string, payerId: string, amount: number): LedgerExpense {
  return {
    id,
    amount,
    currency: "KRW",
    rateToBase: "1",
    paidBy: { kind: "member", memberId: payerId },
    split: { kind: "even", memberIds: everyone },
  };
}

function yenFundExpense(id: string, amount: number): LedgerExpense {
  return {
    id,
    amount,
    currency: "JPY",
    rateToBase: "9.124",
    paidBy: { kind: "fund" },
    split: { kind: "even", memberIds: everyone },
  };
}

function yenContribution(memberId: string, amount: number, rateToBase = "9.124"): FundContribution {
  return { id: `fund-${memberId}`, memberId, amount, currency: "JPY", rateToBase };
}

/** 캔버스 '정산 결과' 화면의 숫자: 총 446,340원, 1인 111,585원 */
const canvasLedger = ledger({
  expenses: [
    wonExpense("hotel", "me", 250_000),
    wonExpense("dinner", "minjun", 120_000),
    wonExpense("train", "seoyeon", 76_340),
  ],
});

describe("summarizeLedger", () => {
  it("캔버스 정산 결과처럼 낸 돈·내 몫·차액을 계산한다", () => {
    const summary = summarizeLedger(canvasLedger);

    expect(summary.totalSpent).toBe(446_340);
    expect(summary.expenseCount).toBe(3);
    expect(
      summary.members.map(({ memberId, paid, share, balance }) => ({
        memberId,
        paid,
        share,
        balance,
      })),
    ).toEqual([
      { memberId: "me", paid: 250_000, share: 111_585, balance: 138_415 },
      { memberId: "minjun", paid: 120_000, share: 111_585, balance: 8_415 },
      { memberId: "seoyeon", paid: 76_340, share: 111_585, balance: -35_245 },
      { memberId: "doyun", paid: 0, share: 111_585, balance: -111_585 },
    ]);
  });

  it("엔화 지출은 입력 당시 환율로 한 번만 바꿔서 나눈다", () => {
    const summary = summarizeLedger(
      ledger({
        expenses: [
          {
            ...yenFundExpense("ramen", 3_600),
            paidBy: { kind: "member", memberId: "me" },
          },
        ],
      }),
    );

    expect(summary.totalSpent).toBe(32_846);
    expect(summary.members.map((member) => member.balance)).toEqual([
      24_634, -8_212, -8_211, -8_211,
    ]);
  });

  it("남은 공금은 보관자가 들고 있으므로 보관자 차액에서 뺀다", () => {
    const summary = summarizeLedger(
      ledger({
        fundContributions: everyone.map((memberId) => yenContribution(memberId, 10_000)),
        expenses: [yenFundExpense("ramen", 3_600), yenFundExpense("keihan", 1_680)],
      }),
    );

    expect(summary.fund).toEqual({
      contributed: 364_960,
      spent: 48_174,
      remaining: 316_786,
    });
    expect(
      summary.members.map(({ contributed, share, fundHeld, balance }) => ({
        contributed,
        share,
        fundHeld,
        balance,
      })),
    ).toEqual([
      { contributed: 91_240, share: 12_044, fundHeld: 316_786, balance: -237_590 },
      { contributed: 91_240, share: 12_044, fundHeld: 0, balance: 79_196 },
      { contributed: 91_240, share: 12_043, fundHeld: 0, balance: 79_197 },
      { contributed: 91_240, share: 12_043, fundHeld: 0, balance: 79_197 },
    ]);
  });

  it("공금이 모자라 보관자가 메운 돈은 보관자가 받는다", () => {
    const pair = ["me", "minjun"];
    const summary = summarizeLedger(
      ledger({
        members: members.slice(0, 2),
        fundContributions: pair.map((memberId) => yenContribution(memberId, 1_000, "10")),
        expenses: [
          {
            id: "taxi",
            amount: 3_000,
            currency: "JPY",
            rateToBase: "10",
            paidBy: { kind: "fund" },
            split: { kind: "even", memberIds: pair },
          },
        ],
      }),
    );

    expect(summary.fund.remaining).toBe(-10_000);
    expect(summary.members.map((member) => member.balance)).toEqual([5_000, -5_000]);
  });

  it("보냄 표시한 송금만큼 차액이 줄어든다", () => {
    const summary = summarizeLedger({
      ...canvasLedger,
      payments: [
        { id: "paid-1", fromMemberId: "seoyeon", toMemberId: "me", amount: 26_830 },
      ],
    });

    expect(
      summary.members.map(({ sent, received, balance }) => ({ sent, received, balance })),
    ).toEqual([
      { sent: 0, received: 26_830, balance: 111_585 },
      { sent: 0, received: 0, balance: 8_415 },
      { sent: 26_830, received: 0, balance: -8_415 },
      { sent: 0, received: 0, balance: -111_585 },
    ]);
  });

  it("기록이 없으면 모두 0이다", () => {
    const summary = summarizeLedger(ledger());

    expect(summary.totalSpent).toBe(0);
    expect(summary.fund).toEqual({ contributed: 0, spent: 0, remaining: 0 });
    expect(summary.members.every((member) => member.balance === 0)).toBe(true);
  });

  it("검사에 걸리는 장부는 계산하지 않는다", () => {
    expect(() => summarizeLedger(ledger({ fundHolderId: "ghost" }))).toThrow(
      MoneyLedgerError,
    );
  });
});
