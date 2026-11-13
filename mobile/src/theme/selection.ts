// 선택 상태를 화면 읽기 프로그램에 전하는 규칙. react-native를 들이지 않아 테스트에서 바로 부른다.

export type SelectRole = "button" | "radio" | "checkbox";

/** 라디오·체크박스는 checked로, 버튼은 selected로 읽힌다. 역할과 상태가 어긋나면 고른 항목을 알 수 없다. */
export function selectionState(role: SelectRole, on: boolean): { selected: boolean } | { checked: boolean } {
  return role === "button" ? { selected: on } : { checked: on };
}

/** checked를 넘기면 라디오로, 안 넘기면 보통 버튼으로 읽힌다. 카드·현금처럼 버튼 모양으로 하나를 고를 때 쓴다. */
export function buttonA11y(checked: boolean | undefined, disabled?: boolean) {
  return checked === undefined
    ? { accessibilityRole: "button" as const, accessibilityState: { disabled: !!disabled } }
    : { accessibilityRole: "radio" as const, accessibilityState: { disabled: !!disabled, checked } };
}

/** 탭 글자. 개수가 0이어도 적는다. 보이는 글자와 읽기 라벨이 같아야 음성 제어로 부를 수 있다. 예: "전체 3". */
export function tabTitle(title: string, count?: number): string {
  return count === undefined ? title : `${title} ${count}`;
}
