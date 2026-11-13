import { describe, expect, it } from "vitest";
import { diary, mono, stickerTone } from "../src/theme/tokens";

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("mobile text palette", () => {
  it.each([
    ["기본 잉크", mono.ink, mono.bg],
    ["보조 글자", mono.gray, mono.bg],
    ["입력 힌트", mono.mutedText, mono.bg],
    ["서재 입력 힌트", mono.mutedText, diary.paper],
    ["크림 스티커", stickerTone.ink, stickerTone.paper],
    ["반전 스티커", stickerTone.paper, stickerTone.ink],
    ["잉크 채운 면 보조 글자", mono.soft, mono.ink],
    ["잉크 채운 면 글자", mono.onInk, mono.ink],
  ])("%s는 일반 글자 4.5:1을 충족한다", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
