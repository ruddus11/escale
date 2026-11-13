import { describe, expect, it } from "vitest";
import { allocateByWeights } from "./allocate";

describe("allocateByWeights", () => {
  it("균등하게 나누고 남는 1원은 앞 사람부터 준다", () => {
    expect(allocateByWeights(32_846, [1, 1, 1, 1])).toEqual([
      8_212, 8_212, 8_211, 8_211,
    ]);
    expect(allocateByWeights(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it("남는 1원은 버린 소수 부분이 큰 사람이 먼저 받는다", () => {
    // 32,846 × 1200/3600 = 10,948.67, 나머지 셋은 7,299.11
    expect(allocateByWeights(32_846, [1_200, 800, 800, 800])).toEqual([
      10_949, 7_299, 7_299, 7_299,
    ]);
    // 10 × 1/6 = 1.67, 10 × 2/6 = 3.33, 10 × 3/6 = 5 → 남는 1은 1.67 쪽
    expect(allocateByWeights(10, [1, 2, 3])).toEqual([2, 3, 5]);
  });

  it("가중치가 0인 사람은 0을 받는다", () => {
    expect(allocateByWeights(101, [0, 1, 1])).toEqual([0, 51, 50]);
  });

  it("합계가 항상 정확히 맞는다", () => {
    const weights = [7, 13, 1, 0, 29, 3];
    for (let total = 0; total <= 500; total += 1) {
      const parts = allocateByWeights(total, weights);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    }
  });

  it("큰 금액도 정밀도를 잃지 않는다", () => {
    expect(allocateByWeights(1_000_000_000_000, [999_999_999_999, 1])).toEqual([
      999_999_999_999, 1,
    ]);
  });

  it("잘못된 입력은 거부한다", () => {
    expect(() => allocateByWeights(10, [0, 0])).toThrow(RangeError);
    expect(() => allocateByWeights(10, [])).toThrow(RangeError);
    expect(() => allocateByWeights(-1, [1])).toThrow(RangeError);
    expect(() => allocateByWeights(1.5, [1])).toThrow(RangeError);
    expect(() => allocateByWeights(10, [1, -1])).toThrow(RangeError);
  });
});
