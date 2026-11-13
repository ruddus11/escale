import { describe, expect, it } from "vitest";
import { isLargeText, safeScale, scaledLines, timelineColumns } from "../src/theme/textScale";

describe("timelineColumns", () => {
  it("keeps the default 52pt time column and 72pt rail at normal size", () => {
    expect(timelineColumns(1)).toEqual({ stacked: false, timeWidth: 52, railInset: 72 });
  });

  it("does not shrink the column below default for small text", () => {
    expect(timelineColumns(0.82)).toEqual({ stacked: false, timeWidth: 52, railInset: 72 });
  });

  it("widens the time column and rail together as text grows", () => {
    expect(timelineColumns(1.2)).toEqual({ stacked: false, timeWidth: 63, railInset: 83 });
    expect(timelineColumns(1.29)).toEqual({ stacked: false, timeWidth: 68, railInset: 88 });
  });

  it("stacks time above the title at accessibility sizes", () => {
    for (const scale of [1.3, 1.35, 1.5, 1.65, 2, 3.12]) expect(timelineColumns(scale)).toEqual({ stacked: true, timeWidth: 0, railInset: 8 });
  });

  it("stacks on a narrow screen as soon as text grows, while preserving default layout", () => {
    expect(timelineColumns(1, 320)).toEqual({ stacked: false, timeWidth: 52, railInset: 72 });
    expect(timelineColumns(1.15, 320)).toEqual({ stacked: true, timeWidth: 0, railInset: 8 });
    expect(timelineColumns(1.15, 390)).toEqual({ stacked: false, timeWidth: 60, railInset: 80 });
  });

  it("treats broken scale values as default size", () => {
    expect(timelineColumns(Number.NaN)).toEqual(timelineColumns(1));
    expect(timelineColumns(0)).toEqual(timelineColumns(1));
    expect(safeScale(-1)).toBe(1);
  });
});

describe("isLargeText", () => {
  it("switches before the time column squeezes titles on narrow screens", () => {
    expect(isLargeText(1.29)).toBe(false);
    expect(isLargeText(1.3)).toBe(true);
    expect(isLargeText(1.15, 320)).toBe(true);
  });
});

describe("scaledLines", () => {
  it("keeps the base line count at default size and never goes below it", () => {
    expect(scaledLines(2, 1)).toBe(2);
    expect(scaledLines(2, 0.82)).toBe(2);
    expect(scaledLines(1, 1.12)).toBe(1);
  });

  it("grows with font scale", () => {
    expect(scaledLines(2, 1.65)).toBe(3);
    expect(scaledLines(2, 3.12)).toBe(6);
    expect(scaledLines(1, 2)).toBe(2);
  });
});
