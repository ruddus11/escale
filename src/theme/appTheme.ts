import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

// Escale 브랜드 두 색. 모바일 `mobile/src/theme/tokens.ts`의 cream·ink·gray와 같은 값이어야 한다.
export const PAPER = "#F6F3EC";
export const INK = "#111111";
export const INK_SOFT = "#5E5E5E";
// 강조색을 따로 두지 않는다. 선택과 주요 행동은 잉크로, 어두운 화면에서는 크림으로 표시한다.
export const APP_ACCENT = INK;
const APP_ACCENT_ON_DARK = PAPER;

export const appTheme = defineTheme({
  name: "margin",
  extends: neutralTheme,
  tokens: {
    "--color-accent": [APP_ACCENT, APP_ACCENT_ON_DARK],
    // 알파 0x24 = 약 14%. 모바일의 hair(잉크 14%)와 같은 농도다.
    "--color-accent-muted": [`${APP_ACCENT}24`, `${APP_ACCENT_ON_DARK}33`],
    "--color-text-accent": [APP_ACCENT, APP_ACCENT_ON_DARK],
    "--color-icon-accent": [APP_ACCENT, APP_ACCENT_ON_DARK],
    "--color-background-body": [PAPER, INK],
    "--color-text-primary": [INK, PAPER],
    "--color-text-secondary": [INK_SOFT, "#BDBDBD"],
  },
});
