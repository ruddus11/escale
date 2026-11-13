// Astryx 부품이 쓰는 기본 문구는 영어만 들어 있어서, 이 앱이 쓰는 부품의 문구만 한국어로 옮긴다.
// 새 부품을 쓰면 node_modules/@astryxdesign/core/locales/en.json에서 키를 찾아 여기에 더한다.
const koText: Record<string, string> = {
  "@astryx.dialog.close": "닫기",
  "@astryx.alertDialog.cancel": "취소",
  "@astryx.popover.close": "닫기",
  "@astryx.tabList.label": "탭",
  "@astryx.moreMenu.label": "더 보기",
  "@astryx.textInput.clearLabel": "{label} 지우기",
  "@astryx.dateInput.placeholder": "날짜 고르기",
  "@astryx.dateInput.dialogLabel": "날짜 고르기",
  "@astryx.dateInput.closeCalendar": "달력 닫기",
  "@astryx.dateInput.openCalendar": "달력 열기",
  "@astryx.dateInput.toggleCalendarClose": "달력 닫기",
  "@astryx.dateInput.clear": "{label} 지우기",
  "@astryx.calendar.previousMonth": "이전 달",
  "@astryx.calendar.nextMonth": "다음 달",
};

/** Astryx 카탈로그 형식({ defaultMessage })으로 바꾼 한국어 문구 */
export const astryxKoMessages = Object.fromEntries(
  Object.entries(koText).map(([key, text]) => [key, { defaultMessage: text }]),
);
