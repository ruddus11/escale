import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import brand from "../src/theme/brand.json";

describe("brand glyph", () => {
  // 앱 안 인장은 승인된 SVG 원본과 같은 경로여야 한다. 손으로 다시 그리지 않는다.
  it("matches the approved traveler glyph source", () => {
    const svg = readFileSync(new URL(`../${brand.glyph.source}`, import.meta.url), "utf8");
    expect(svg).toContain(`viewBox="${brand.glyph.viewBox}"`);
    expect(svg).toContain(`fill-rule="${brand.glyph.fillRule}"`);
    expect(svg.match(/ d="([^"]+)"/)?.[1]).toBe(brand.glyph.d);
  });

  it("no longer carries the old M seal paths", () => {
    expect("paths" in brand).toBe(false);
  });
});
