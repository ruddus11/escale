import { describe, expect, it } from "vitest";
import type { LedgerExpense, MoneyLedger } from "./types";
import { validateExpense, validateLedger } from "./validateLedger";

const members = [
  { id: "me", name: "나" },
  { id: "minjun", name: "민준" },
];

function expense(overrides: Partial<LedgerExpense> = {}): LedgerExpense {
  return {
    id: "ramen",
    amount: 3_600,
    currency: "JPY",
    rateToBase: "9.124",
    paidBy: { kind: "member", memberId: "me" },
    split: { kind: "even", memberIds: ["me", "minjun"] },
    ...overrides,
  };
}

function ledger(overrides: Partial<MoneyLedger> = {}): MoneyLedger {
  return {
    baseCurrency: "KRW",
    members,
    fundHolderId: "me",
    expenses: [expense()],
    fundContributions: [],
    payments: [],
    ...overrides,
  };
}

describe("validateLedger", () => {
  it("올바른 장부에는 문제가 없다", () => {
    expect(validateLedger(ledger())).toEqual([]);
  });

  it("동행자 중복과 공금 보관자를 확인한다", () => {
    expect(
      validateLedger(
        ledger({ members: [...members, { id: "me", name: "나2" }], expenses: [] }),
      ),
    ).toEqual([{ code: "duplicate-member", memberId: "me" }]);
    expect(validateLedger(ledger({ fundHolderId: "ghost" }))).toEqual([
      { code: "unknown-fund-holder", memberId: "ghost" },
    ]);
  });

  it("기준 통화가 지원 목록에 없으면 다른 검사 없이 멈춘다", () => {
    expect(validateLedger(ledger({ baseCurrency: "ZZZ" as never }))).toEqual([
      { code: "unknown-currency" },
    ]);
  });

  it("공금 걷기와 보냄 기록을 확인한다", () => {
    const issues = validateLedger(
      ledger({
        expenses: [],
        fundContributions: [
          { id: "c1", memberId: "ghost", amount: 10_000, currency: "JPY", rateToBase: "9.124" },
          { id: "c2", memberId: "me", amount: 0, currency: "JPY", rateToBase: "9.124" },
        ],
        payments: [
          { id: "p1", fromMemberId: "me", toMemberId: "me", amount: 1_000 },
          { id: "p2", fromMemberId: "minjun", toMemberId: "me", amount: 1.5 },
        ],
      }),
    );

    expect(issues).toEqual([
      { code: "unknown-member", entryId: "c1", memberId: "ghost" },
      { code: "invalid-amount", entryId: "c2" },
      { code: "self-payment", entryId: "p1" },
      { code: "invalid-amount", entryId: "p2" },
    ]);
  });
});

describe("validateExpense", () => {
  const context = { baseCurrency: "KRW" as const, members };

  it.each<[string, Partial<LedgerExpense>, ReturnType<typeof validateExpense>]>([
    ["금액이 0", { amount: 0 }, [{ code: "invalid-amount", entryId: "ramen" }]],
    ["금액이 소수", { amount: 3.5 }, [{ code: "invalid-amount", entryId: "ramen" }]],
    [
      "1조 초과",
      { amount: 1_000_000_000_001, currency: "KRW", rateToBase: "1" },
      [{ code: "invalid-amount", entryId: "ramen" }],
    ],
    [
      "환산하면 1조 초과",
      { amount: 200_000_000_000 },
      [{ code: "invalid-amount", entryId: "ramen" }],
    ],
    ["환율 형식", { rateToBase: "9,124" }, [{ code: "invalid-rate", entryId: "ramen" }]],
    [
      "원화인데 환율이 1이 아님",
      { currency: "KRW", rateToBase: "1.0" },
      [{ code: "base-rate-must-be-one", entryId: "ramen" }],
    ],
    [
      "지원하지 않는 통화",
      { currency: "ZZZ" as never },
      [{ code: "unknown-currency", entryId: "ramen" }],
    ],
    [
      "모르는 결제자",
      { paidBy: { kind: "member", memberId: "ghost" } },
      [{ code: "unknown-member", entryId: "ramen", memberId: "ghost" }],
    ],
    [
      "나눠 낼 사람 없음",
      { split: { kind: "even", memberIds: [] } },
      [{ code: "empty-split", entryId: "ramen" }],
    ],
    [
      "같은 사람 두 번",
      { split: { kind: "even", memberIds: ["me", "me"] } },
      [{ code: "duplicate-member", entryId: "ramen", memberId: "me" }],
    ],
    [
      "모르는 사람과 나눔",
      { split: { kind: "even", memberIds: ["me", "ghost"] } },
      [{ code: "unknown-member", entryId: "ramen", memberId: "ghost" }],
    ],
    [
      "사람별 금액 합이 다름",
      {
        split: {
          kind: "custom",
          shares: [
            { memberId: "me", amount: 1_000 },
            { memberId: "minjun", amount: 2_000 },
          ],
        },
      },
      [{ code: "split-sum-mismatch", entryId: "ramen" }],
    ],
    [
      "사람별 금액이 음수",
      {
        split: {
          kind: "custom",
          shares: [
            { memberId: "me", amount: 3_700 },
            { memberId: "minjun", amount: -100 },
          ],
        },
      },
      [{ code: "invalid-amount", entryId: "ramen" }],
    ],
  ])("%s", (_name, overrides, expected) => {
    expect(validateExpense(expense(overrides), context)).toEqual(expected);
  });

  it("공금 결제와 0원이 섞인 사람별 금액은 받는다", () => {
    expect(
      validateExpense(
        expense({
          paidBy: { kind: "fund" },
          split: {
            kind: "custom",
            shares: [
              { memberId: "me", amount: 3_600 },
              { memberId: "minjun", amount: 0 },
            ],
          },
        }),
        context,
      ),
    ).toEqual([]);
  });
});
