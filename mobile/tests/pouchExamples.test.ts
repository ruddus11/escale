import { describe, expect, it } from "vitest";
import { spendExamples } from "../src/data/pouchExamples";
import { readPouch } from "../src/data/pouchIntents";
import type { CurrencyCode } from "../../src/domain/money/types";

const langs = ["ko", "en-US", "en-GB", "ja"] as const;
const locals: CurrencyCode[] = ["JPY", "KRW", "EUR", "USD", "GBP", "CNY", "THB", "TWD", "HKD", "VND", "CHF"];

describe("spend examples", () => {
  it("uses the trip's local currency instead of euros", () => {
    expect(spendExamples("JPY", "ko")).toEqual({ taxi: "1500엔", coffee: "500엔" });
    expect(spendExamples("JPY", "en-US")).toEqual({ taxi: "1500 yen", coffee: "500 yen" });
    expect(spendExamples("JPY", "ja")).toEqual({ taxi: "1500円", coffee: "500円" });
    expect(spendExamples("EUR", "ko")).toEqual({ taxi: "12유로", coffee: "3.5유로" });
  });

  it("falls back to the currency code for currencies without a word", () => {
    expect(spendExamples("CHF", "ko")).toEqual({ taxi: "12 CHF", coffee: "3.5 CHF" });
  });

  it("writes examples the pouch reads back as that currency", () => {
    for (const local of locals)
      for (const lang of langs) {
        const { taxi, coffee } = spendExamples(local, lang);
        for (const said of [`taxi ${taxi}`, `coffee ${coffee}`])
          expect(readPouch(said, { localCurrency: local, packing: [] }), `${local} ${lang} ${said}`).toMatchObject({ kind: "expense", currency: local });
      }
  });
});
