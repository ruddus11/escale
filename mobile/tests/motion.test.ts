import { describe, expect, it } from "vitest";
import { countAt, pathLength, stableTilt, stagger } from "../src/theme/motion";

describe("diary motion math", () => {
  it("같은 id는 언제나 같은 기울기를 돌려준다", () => {
    expect(stableTilt("photo-1")).toBe(stableTilt("photo-1"));
  });

  it("기울기는 범위 안에 있고 0도 근처를 피한다", () => {
    const tilts = Array.from({ length: 200 }, (_, i) => stableTilt(`photo-${i}`, 4));
    for (const tilt of tilts) {
      expect(Math.abs(tilt)).toBeLessThanOrEqual(4);
      expect(Math.abs(tilt)).toBeGreaterThanOrEqual(1.2);
    }
    expect(tilts.some((tilt) => tilt > 0)).toBe(true);
    expect(tilts.some((tilt) => tilt < 0)).toBe(true);
  });

  it("차례 지연은 여덟 번째에서 멈춘다", () => {
    expect([0, 1, 8, 30].map((i) => stagger(i))).toEqual([0, 55, 440, 440]);
  });

  it("세는 숫자는 0에서 시작해 목표에서 끝난다", () => {
    expect(countAt(8246, 0)).toBe(0);
    expect(countAt(8246, 1)).toBe(8246);
    expect(countAt(8246, 2)).toBe(8246);
    expect(countAt(8246, 0.5)).toBeGreaterThan(8246 / 2);
  });

  it("꺾은선 길이를 더한다", () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
    expect(pathLength([{ x: 1, y: 1 }])).toBe(0);
  });
});
