import { describe, expect, it } from "vitest";
import { frequentExpenses } from "../src/data/expenseShortcuts";

type Row = Parameters<typeof frequentExpenses>[0][number];
let n = 0;
// 하루에 한 건씩 시각을 늘려 "최근" 비교가 분명하게 한다.
const row = (title: string, amount: number, patch: Partial<Row> = {}): Row => ({
  title,
  amount,
  currency: "JPY",
  category: "food",
  method: "cash",
  occurredAt: new Date(Date.UTC(2026, 9, 1) + n++ * 86_400_000).toISOString(),
  ...patch,
});

describe("frequentExpenses", () => {
  it("returns nothing for an empty history", () => {
    expect(frequentExpenses([])).toEqual([]);
  });

  it("needs at least two of the same expense", () => {
    expect(frequentExpenses([row("편의점", 500), row("지하철", 210, { category: "transport" })])).toEqual([]);
    expect(frequentExpenses([row("편의점", 500), row("편의점", 500)])).toEqual([
      { title: "편의점", category: "food", amount: 500, currency: "JPY", method: "cash", count: 2 },
    ]);
    expect(frequentExpenses([row("편의점", 500), row("편의점", 500)], { minRepeat: 3 })).toEqual([]);
  });

  it("orders by count, then most recent, and keeps at most four", () => {
    const history = [
      ...[1, 2, 3].map(() => row("지하철", 210, { category: "transport", method: "card" })),
      row("커피", 450), row("빵", 300), row("물", 120), row("우동", 800),
      row("커피", 450), row("빵", 300), row("물", 120), row("우동", 800),
    ];
    const titles = frequentExpenses(history).map((s) => s.title);
    // 두 번씩인 넷 중 마지막에 쓴 우동이 앞선다. 다섯째(커피)는 잘린다.
    expect(titles).toEqual(["지하철", "우동", "물", "빵"]);
    expect(frequentExpenses(history, { limit: 2 }).map((s) => s.title)).toEqual(["지하철", "우동"]);
  });

  it("breaks exact ties the same way every time", () => {
    const at = "2026-10-05T03:00:00.000Z";
    const a = [row("B", 100, { occurredAt: at }), row("A", 100, { occurredAt: at }), row("B", 100, { occurredAt: at }), row("A", 100, { occurredAt: at })];
    const first = frequentExpenses(a).map((s) => s.title);
    expect(first).toEqual(["A", "B"]);
    expect(frequentExpenses([...a].reverse()).map((s) => s.title)).toEqual(first);
  });

  it("treats the same amount in another currency as another pattern", () => {
    const history = [row("Coffee", 500), row("Coffee", 500, { currency: "KRW" }), row("Coffee", 500), row("Coffee", 500, { currency: "KRW" })];
    const found = frequentExpenses(history);
    expect(found.map((s) => s.currency).sort()).toEqual(["JPY", "KRW"]);
    expect(found.every((s) => s.count === 2)).toBe(true);
    expect(frequentExpenses(history, { currencies: ["KRW"] }).map((s) => s.currency)).toEqual(["KRW"]);
  });

  it("separates category and payment method but ignores spacing and case in the title", () => {
    expect(frequentExpenses([row("Lawson", 500), row("Lawson", 500, { method: "card" })])).toEqual([]);
    expect(frequentExpenses([row("Lawson", 500), row("Lawson", 500, { category: "drink" })])).toEqual([]);
    const merged = frequentExpenses([row(" lawson ", 500), row("Lawson  Store", 500), row("LAWSON", 500), row("lawson store", 500)]);
    expect(merged.map((s) => [s.title, s.count])).toEqual([["lawson store", 2], ["LAWSON", 2]]);
  });

  it("reads old expenses without a method as card and skips unusable rows", () => {
    const history = [row("Taxi", 1200, { method: undefined }), row("Taxi", 1200, { method: "card" }), row("", 300), row("", 300), row("Bad", 0), row("Bad", 0), row("Odd", 1.5), row("Odd", 1.5)];
    expect(frequentExpenses(history)).toEqual([{ title: "Taxi", category: "food", amount: 1200, currency: "JPY", method: "card", count: 2 }]);
  });
});
