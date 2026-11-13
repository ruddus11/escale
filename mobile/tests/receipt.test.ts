import { describe, expect, it } from "vitest";
import { amountsIn, parseReceipt } from "../src/data/receipt";

describe("amountsIn", () => {
  it("reads common number styles", () => {
    expect(amountsIn("TOTAL 1,234.56", "USD")).toEqual([123456]);
    expect(amountsIn("Total 1.234,56 €", "EUR")).toEqual([123456]);
    expect(amountsIn("합계 12,000", "KRW")).toEqual([12000]);
    expect(amountsIn("合計 ¥1,580", "JPY")).toEqual([1580]);
    expect(amountsIn("Café 3,50", "EUR")).toEqual([350]);
  });
});

describe("parseReceipt", () => {
  it("finds the total, shop and currency on a Korean card receipt", () => {
    const lines = ["스타벅스 해운대점", "2026-10-14 13:05", "아이스 아메리카노 1 4,500", "카페라떼 1 5,000", "합계 9,500", "부가세 864", "신용카드 9,500"];
    expect(parseReceipt(lines, "KRW")).toEqual({ title: "스타벅스 해운대점", amount: 9500, currency: "KRW", category: "drink", method: "card" });
  });

  it("reads a European receipt with the total on the next line", () => {
    const lines = ["Pastelaria Alfama", "Rua Augusta 12", "Pastel de nata x2 2,60", "Café 1,20", "TOTAL", "3,80 €", "IVA 23% 0,71", "Multibanco"];
    expect(parseReceipt(lines, "KRW")).toMatchObject({ title: "Pastelaria Alfama", amount: 380, currency: "EUR" });
  });

  it("prefers the final total over subtotal and ignores change", () => {
    const lines = ["ローソン", "小計 ¥1,200", "合計 ¥1,320", "お預り ¥2,000", "お釣り ¥680", "現金"];
    expect(parseReceipt(lines, "JPY")).toMatchObject({ amount: 1320, currency: "JPY", method: "cash" });
  });

  it("falls back to the largest amount and leaves unknowns empty", () => {
    expect(parseReceipt(["Taxi", "12.40", "2.00"], "EUR")).toMatchObject({ title: "Taxi", amount: 1240, category: "transport" });
    expect(parseReceipt(["thank you"], "EUR")).toMatchObject({ amount: undefined });
    expect(parseReceipt([], "EUR")).toBeUndefined();
  });
});
