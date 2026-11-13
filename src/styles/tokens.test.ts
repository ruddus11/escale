import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

function readHexToken(name: string): string {
  const value = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (value === undefined) throw new Error(`Missing color token: ${name}`);
  return value;
}

function contrastRatio(left: string, right: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) =>
      Number.parseInt(hex.slice(index, index + 2), 16) / 255,
    );
    const linear = channels.map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const brighter = Math.max(luminance(left), luminance(right));
  const darker = Math.min(luminance(left), luminance(right));
  return (brighter + 0.05) / (darker + 0.05);
}

describe("sunlight color tokens", () => {
  it.each(["text-secondary", "text-tertiary", "action-blue"])(
    "%s remains readable on the white canvas",
    (token) => {
      expect(contrastRatio(readHexToken(token), readHexToken("canvas"))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("blue labels remain readable on their soft background", () => {
    expect(
      contrastRatio(readHexToken("action-blue"), readHexToken("action-blue-soft")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
