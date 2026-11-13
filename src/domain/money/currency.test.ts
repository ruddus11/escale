import { describe, expect, it } from "vitest";
import { convertToBase, isCurrencyCode, parseRate } from "./currency";

describe("isCurrencyCode", () => {
  it("지원하는 통화만 받는다", () => {
    expect(["KRW", "JPY", "USD"].every(isCurrencyCode)).toBe(true);
    expect(["ZZZ", "krw", "", "toString", undefined, 1].some(isCurrencyCode)).toBe(
      false,
    );
  });
});

describe("parseRate", () => {
  it.each([
    ["9.124", 9_124n, 1_000n],
    ["1380.12", 138_012n, 100n],
    ["0.000725", 725n, 1_000_000n],
    ["1", 1n, 1n],
    ["999999.9999999999", 9_999_999_999_999_999n, 10_000_000_000n],
  ])("%s를 분수로 읽는다", (rate, numerator, denominator) => {
    expect(parseRate(rate)).toEqual({ numerator, denominator });
  });

  it.each([
    "0",
    "0.0",
    "09.1",
    "9.",
    ".5",
    "1e3",
    "-1",
    " 9.1",
    "9,124",
    "1234567",
    "1.12345678901",
    "",
  ])("%j는 환율로 받지 않는다", (rate) => {
    expect(parseRate(rate)).toBeUndefined();
  });
});

describe("convertToBase", () => {
  it("엔화를 입력 당시 환율로 원화로 바꾸고 0.5 미만은 버린다", () => {
    expect(
      convertToBase({ amount: 3_600, currency: "JPY", rateToBase: "9.124" }, "KRW"),
    ).toBe(32_846);
  });

  it("센트 단위 달러를 원화로 바꾼다", () => {
    expect(
      convertToBase({ amount: 8_600, currency: "USD", rateToBase: "1380.12" }, "KRW"),
    ).toBe(118_690);
  });

  it("원화를 센트 단위 달러로 바꾼다", () => {
    expect(
      convertToBase({ amount: 10_000, currency: "KRW", rateToBase: "0.000725" }, "USD"),
    ).toBe(725);
  });

  it("기준 통화 금액은 그대로 둔다", () => {
    expect(
      convertToBase({ amount: 50_000, currency: "KRW", rateToBase: "1" }, "KRW"),
    ).toBe(50_000);
  });

  it("정확히 0.5이면 올린다", () => {
    expect(
      convertToBase({ amount: 1, currency: "JPY", rateToBase: "2.5" }, "KRW"),
    ).toBe(3);
    expect(
      convertToBase({ amount: 1, currency: "JPY", rateToBase: "2.4999999999" }, "KRW"),
    ).toBe(2);
  });

  it("부동소수점이면 틀리는 반올림도 정확히 한다", () => {
    // 100 * 1.005는 부동소수점으로 100.49999999999999라 Math.round가 100을 낸다
    expect(
      convertToBase({ amount: 100, currency: "JPY", rateToBase: "1.005" }, "KRW"),
    ).toBe(101);
  });

  it("형식이 틀린 환율이나 음수·소수 금액은 계산하지 않는다", () => {
    expect(() =>
      convertToBase({ amount: 100, currency: "JPY", rateToBase: "abc" }, "KRW"),
    ).toThrow(RangeError);
    expect(() =>
      convertToBase({ amount: -1, currency: "JPY", rateToBase: "9.124" }, "KRW"),
    ).toThrow(RangeError);
    expect(() =>
      convertToBase({ amount: 1.5, currency: "JPY", rateToBase: "9.124" }, "KRW"),
    ).toThrow(RangeError);
  });
});
