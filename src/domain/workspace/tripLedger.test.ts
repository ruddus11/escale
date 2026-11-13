import { describe, expect, it } from "vitest";
import { summarizeLedger } from "../money/summarizeLedger";
import { validateExpense } from "../money/validateLedger";
import { createOwnerExpense, toMoneyLedger } from "./tripLedger";
import type { TripSettings, TripWorkspace } from "./types";

const settings: TripSettings = {
  title: "가을 여행",
  startDate: "2026-10-12",
  endDate: "2026-10-16",
  timeZone: "Asia/Tokyo",
  baseCurrency: "KRW",
  localCurrency: "JPY",
  members: [
    { id: "me", name: "나" },
    { id: "minji", name: "민지" },
  ],
  ownerId: "me",
};

function trip(ledger: TripWorkspace["ledger"]): Pick<TripWorkspace, "settings" | "ledger"> {
  return { settings, ledger };
}

describe("toMoneyLedger", () => {
  it("총무를 공금 보관자로 삼아 엔진 입력을 만든다", () => {
    const moneyLedger = toMoneyLedger(
      trip({
        expenses: [
          {
            id: "lunch",
            amount: 4_600,
            currency: "JPY",
            rateToBase: "9.1304",
            paidBy: { kind: "member", memberId: "minji" },
            split: { kind: "even", memberIds: ["me", "minji"] },
            category: "food",
            occurredAt: "2026-10-14T12:30:00+09:00",
          },
        ],
        fundContributions: [],
        payments: [],
      }),
    );

    expect(moneyLedger.fundHolderId).toBe("me");
    expect(moneyLedger.baseCurrency).toBe("KRW");
    // ¥4,600 × 9.1304 = 41,999.84 → 42,000원, 둘이 21,000원씩
    expect(summarizeLedger(moneyLedger).members.map((member) => member.balance)).toEqual([
      -21_000, 21_000,
    ]);
  });
});

describe("createOwnerExpense", () => {
  it("총무 혼자 기준 통화로 낸 지출을 만든다", () => {
    const expense = createOwnerExpense(settings, {
      id: "taxi",
      amount: 12_000,
      category: "transport",
      note: "공항 택시",
      occurredAt: "2026-10-12T21:00:00+09:00",
    });

    expect(expense).toEqual({
      id: "taxi",
      amount: 12_000,
      currency: "KRW",
      rateToBase: "1",
      paidBy: { kind: "member", memberId: "me" },
      split: { kind: "even", memberIds: ["me"] },
      category: "transport",
      note: "공항 택시",
      occurredAt: "2026-10-12T21:00:00+09:00",
    });
    expect(validateExpense(expense, settings)).toEqual([]);
  });

  it("메모가 없으면 note 키를 만들지 않는다", () => {
    const expense = createOwnerExpense(settings, {
      id: "water",
      amount: 1_500,
      category: "drink",
      occurredAt: "2026-10-12T15:00:00+09:00",
    });

    expect("note" in expense).toBe(false);
  });
});
