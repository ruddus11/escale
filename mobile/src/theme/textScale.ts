// 큰 글씨(iOS Dynamic Type·Android 글꼴 크기)에 맞춘 배치 값. react-native를 들이지 않아 테스트에서 바로 부른다.
// fontScale은 useWindowDimensions().fontScale 값이다. 예: iOS 기본 1.0, 접근성 AX1 ≈ 1.65, AX5 ≈ 3.1, Android 최대 2.0.

/** 1.3배부터 가로 열을 쌓는다. 360pt 이하에서는 글씨가 커지는 즉시 쌓는다. */
export const STACK_SCALE = 1.3;

// 시간표 시각 칸 기준 너비(pt). 17pt 고정폭 숫자로 "13:40"이 한 줄에 들어간다.
const TIME_COLUMN = 52;
// 시각 칸과 체크 사이 간격 12pt, 18pt 체크 동그라미의 중심 8pt. 시간표 줄의 gap·Check 크기와 함께 바꾼다.
const TIME_GAP = 12;
const CHECK_CENTER = 8;

/** 0·NaN처럼 잘못 들어온 값은 기본 크기(1)로 본다. */
export function safeScale(fontScale: number): number {
  return Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
}

// 좁은 화면은 1.3배 전에 시각·체크·도착 라벨이 제목 폭을 대부분 차지한다.
export function isLargeText(fontScale: number, screenWidth = Number.POSITIVE_INFINITY): boolean {
  const scale = safeScale(fontScale);
  return scale >= STACK_SCALE || (screenWidth <= 360 && scale > 1);
}

/**
 * 시간표 열 배치. 기본 크기에서는 시각 52pt + 세로선 72pt로 예전과 같다.
 * 글씨가 커지면 시각 칸을 같은 비율로 넓히고(1.2배 → 63pt, 세로선 83pt),
 * 쌓는 배율부터는 시각을 제목 위 한 줄로 올려 세로선을 체크 중심(8pt)에 둔다.
 * 작은 글씨(1 미만)에서도 52pt를 유지해 다른 줄과 정렬이 흔들리지 않게 한다.
 */
export function timelineColumns(fontScale: number, screenWidth = Number.POSITIVE_INFINITY): { stacked: boolean; timeWidth: number; railInset: number } {
  const scale = safeScale(fontScale);
  if (isLargeText(scale, screenWidth)) return { stacked: true, timeWidth: 0, railInset: CHECK_CENTER };
  const timeWidth = Math.ceil(TIME_COLUMN * Math.max(1, scale));
  return { stacked: false, timeWidth, railInset: timeWidth + TIME_GAP + CHECK_CENTER };
}

/**
 * 줄 수 제한을 글씨 배율만큼 늘린다. 큰 글씨에서 같은 칸에 담기는 글자가 줄어 같은 줄 수로는 이름이 너무 일찍 잘린다.
 * 예: 2줄 → 1.0배 2줄, 1.65배 3줄, 3.1배 6줄. 기본보다 줄이지는 않는다.
 */
export function scaledLines(base: number, fontScale: number): number {
  return Math.max(base, Math.round(base * safeScale(fontScale)));
}
