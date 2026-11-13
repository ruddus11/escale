import { describe, expect, it } from "vitest";
import { dayStripWidth } from "../src/data/dayStripWidth";

const row = (width: number, count: number, gap = 8) => count * width + (count - 1) * gap;

describe("day strip width", () => {
  it("fits a week on a phone so the last day is not hidden", () => {
    const width = dayStripWidth({ available: 358, count: 7, gap: 8, min: 44 });
    expect(width).toBeGreaterThanOrEqual(44);
    expect(row(width, 7)).toBeLessThanOrEqual(358);
  });

  it("keeps short trips at their usual width", () => {
    expect(dayStripWidth({ available: 358, count: 4, gap: 8, min: 44 })).toBe(64);
  });

  it("lets half of the next day peek out when the days do not fit", () => {
    const width = dayStripWidth({ available: 358, count: 10, gap: 8, min: 44 });
    expect(width).toBeGreaterThanOrEqual(44);
    const full = Math.floor((358 + 8) / (width + 8));
    const shown = 358 - full * (width + 8);
    expect(shown).toBeCloseTo(width / 2, 5);
  });

  it("never goes below the touch size at large text", () => {
    expect(dayStripWidth({ available: 358, count: 7, gap: 8, min: 70 })).toBeGreaterThanOrEqual(70);
  });

  it("waits for a measured width", () => {
    expect(dayStripWidth({ available: 0, count: 7, gap: 8, min: 44 })).toBe(64);
  });
});
