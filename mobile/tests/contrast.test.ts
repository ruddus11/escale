import { describe, expect, it } from "vitest";
import { diary, mono, stickerTone, textBackgrounds } from "../src/theme/tokens";

// WCAG 2.x 상대 휘도 대비. 예: #111111 on #F6F3EC ≈ 17.0:1.
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

// 반투명 바탕을 그 아래 색 위에 합성한다. 예: frost(크림 86%)를 잉크 #111111 위에 → #D6D3CD.
function composite(rgba: string, under: string): string {
  const [r, g, b, alpha] = rgba.match(/[\d.]+/g)!.map(Number);
  return "#" + [r, g, b]
    .map((channel, index) => Math.round(channel * alpha + Number.parseInt(under.slice(1 + index * 2, 3 + index * 2), 16) * (1 - alpha)))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
}

const textTokens = { ink: mono.ink, gray: mono.gray, mutedText: mono.mutedText, warn: mono.warn };
// 예전 이름도 같은 값을 가리키는지 함께 돈다. 별칭이 다른 크림으로 갈라지면 여기서 걸린다.
// frost는 지갑 카드와 아래 입력 줄의 반투명 면이다. 둘 다 바다 바탕(mono.bg) 위에 놓인다. 입력 칸은 frost를 한 번 더 깐다.
// 스티커는 앱 글자 바탕이 아니라 따로 인쇄한 두 색(stickerTone)이라 themeTokens.test.ts에서 따로 본다.
const frostOnBg = composite(mono.frost, mono.bg);
const backgrounds = { ...textBackgrounds, "mono.bg": mono.bg, "diary.paper": diary.paper, "diary.page": diary.page, "diary.surface": diary.surface, "frost on bg": frostOnBg, "frost on frost": composite(mono.frost, frostOnBg) };

describe("text tokens on every background", () => {
  const pairs = Object.entries(textTokens).flatMap(([text, fg]) => Object.entries(backgrounds).map(([bg, back]) => [`${text} on ${bg}`, fg, back] as const));
  it.each(pairs)("%s는 4.5:1 이상", (_name, fg, back) => {
    expect(contrast(fg, back)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["onInk on ink (채운 버튼)", mono.onInk, mono.ink],
    ["soft on ink", mono.soft, mono.ink],
    ["sea on warn (위험 채운 버튼)", mono.bg, mono.warn],
  ])("%s는 4.5:1 이상", (_name, fg, back) => {
    expect(contrast(fg, back)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("reference palette", () => {
  it("정보 지면은 중립 흰색 바탕을 사용한다", () => {
    expect(new Set([mono.bg, diary.paper, diary.page])).toEqual(new Set(["#FFFFFF"]));
    expect(diary.surface).not.toBe(mono.bg);
  });
  it("채운 버튼의 글자는 흰색이다", () => {
    expect(mono.onInk).toBe(mono.bg);
  });
});

// 표지 사진 띠(2026-11-13). 띠는 반투명이라 사진이 가장 밝은 경우(흰색) 위에 합성해 본다.
describe("cover hero band", () => {
  const band = composite(mono.heroVeil, "#FFFFFF");
  it.each([
    ["white title on veil", mono.white, band],
    ["onSea dates on veil", mono.onSea, band],
    ["sea on coral status chip", mono.sea, mono.coralChip],
    // 여권 표지 가죽 사진의 가장 밝은 결 색. assets/passport/cover.jpg를 만들 때 쓴 상한이다.
    ["foil on brightest leather", mono.foil, "#245C68"],
    ["visa captions on visa paper", mono.visaMuted, mono.visaPaper],
  ])("%s는 4.5:1 이상", (_name, fg, back) => {
    expect(contrast(fg, back)).toBeGreaterThanOrEqual(4.5);
  });
});
