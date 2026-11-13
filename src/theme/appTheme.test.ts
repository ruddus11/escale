import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { APP_ACCENT, INK, INK_SOFT, PAPER, appTheme } from "./appTheme";

const cssTokens = readFileSync("src/styles/tokens.css", "utf8");
const cssColor = (name: string) => {
  const value = new RegExp(`${name}: (#[0-9a-f]{6})`, "i").exec(cssTokens)?.[1];
  if (!value) throw new Error(`Missing color token: ${name}`);
  return value;
};

function contrastRatio(left: string, right: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(
      (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
    );
    const linear = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const brighter = Math.max(luminance(left), luminance(right));
  const darker = Math.min(luminance(left), luminance(right));
  return (brighter + 0.05) / (darker + 0.05);
}

describe("appTheme", () => {
  it("uses the app name", () => {
    expect(appTheme.name).toBe("margin");
  });

  it("uses ink as the accent and cream paper as the page", () => {
    expect(appTheme.tokens["--color-accent"]).toMatch(new RegExp(APP_ACCENT, "i"));
    expect(appTheme.tokens["--color-background-body"]).toMatch(new RegExp(PAPER, "i"));
  });

  it.each([
    ["강조 글자 / 종이", APP_ACCENT, PAPER],
    ["흰 글자 / 잉크 버튼", "#FFFFFF", APP_ACCENT],
    ["잉크 글자 / 종이", INK, PAPER],
    ["연한 잉크 글자 / 종이", INK_SOFT, PAPER],
  ])("%s는 4.5:1 이상으로 읽힌다", (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("tints selected states with a faint ink", () => {
    expect(appTheme.tokens["--color-accent-muted"]).toMatch(/#11111124/i);
  });

  // 웹과 모바일이 같은 브랜드 색을 쓰는지 모바일 토큰 원문과 맞춰 본다.
  it("matches the mobile brand colors", () => {
    const mobileTokens = readFileSync("mobile/src/theme/tokens.ts", "utf8");
    expect(mobileTokens).toContain(`const cream = "${PAPER}"`);
    expect(mobileTokens).toContain(`const ink = "${INK}"`);
    expect(mobileTokens).toContain(`gray: "${INK_SOFT}"`);
  });

  it.each([
    ["기본 보조 글자", "--text-secondary", "--canvas"],
    ["연한 카드의 보조 글자", "--text-secondary", "--surface-elevated"],
    ["기본 작은 글자", "--text-tertiary", "--canvas"],
    ["보드 보조 글자", "--board-muted", "--board"],
    ["경고 글자", "--warning-orange", "--surface-warning"],
    ["성공 글자", "--success-green", "--success-green-soft"],
    ["오류 글자", "--destructive-red", "--surface-danger"],
  ])("%s는 4.5:1 이상이다", (_name, foreground, background) => {
    expect(contrastRatio(cssColor(foreground), cssColor(background))).toBeGreaterThanOrEqual(4.5);
  });
});
