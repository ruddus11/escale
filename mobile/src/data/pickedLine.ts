import { STRINGS } from "../i18n/strings";

/** 기존 맞춤 추천 기록에는 언어별 표식이 남아 있어 지워도 Google 출처를 계속 표시한다. */
export function isPickedLine(line: string | undefined): boolean {
  return !!line && STRINGS["rec.marker"].some((marker) => line.endsWith(marker));
}
