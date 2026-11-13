// 예약 시각은 저장 형식 "HH:MM"(24시간, 두 자리) 그대로 주고받는다. 선택기는 Date를 쓰므로 여기서만 바꾼다.
// 형식 규칙은 공용 검사(validateReservation의 isTime)와 같다. 예: "09:05" → { hour: 9, minute: 5 }.
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ClockTime {
  hour: number;
  minute: number;
}

export function parseTimeText(text: string | undefined): ClockTime | undefined {
  const match = TIME.exec(text ?? "");
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : undefined;
}

export function formatTimeText({ hour, minute }: ClockTime): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// 선택기가 돌려준 Date의 기기 시계 시·분만 읽는다. 날짜와 시간대는 예약의 다른 칸이 정한다.
export function timeTextOfDate(date: Date): string {
  return formatTimeText({ hour: date.getHours(), minute: date.getMinutes() });
}

// 선택기를 열 때 보일 Date. 비었거나 형식이 틀린 값은 정오(12:00)에서 시작하고, 사용자가 고르기 전에는 저장값을 바꾸지 않는다.
export function dateForTimeText(text: string | undefined, base: Date = new Date()): Date {
  const time = parseTimeText(text) ?? { hour: 12, minute: 0 };
  const date = new Date(base.getTime());
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
}

// 웹 선택기의 한 번 이동. 시는 delta시간, 분은 delta분씩 움직이고 각각 자기 범위 안에서 돈다(23시 → 0시, 59분 → 0분).
// 분은 1분과 10분 버튼을 함께 두어 0–59 어느 값이든 고를 수 있다. 예: 09:07에서 +1 → 09:08, -10 → 09:57.
export function stepTimeText(text: string | undefined, unit: "hour" | "minute", delta: number): string {
  const time = parseTimeText(text) ?? { hour: 12, minute: 0 };
  const wrap = (value: number, size: number) => ((value % size) + size) % size;
  if (unit === "hour") return formatTimeText({ hour: wrap(time.hour + delta, 24), minute: time.minute });
  return formatTimeText({ hour: time.hour, minute: wrap(time.minute + delta, 60) });
}
