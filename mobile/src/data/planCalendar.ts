// 계획 캘린더의 달 격자. 날짜 문자열(YYYY-MM-DD)만 다뤄 기기 시간대와 상관없이 같은 격자를 만든다.

export interface MonthGrid {
  key: string;
  year: number;
  month: number;
  /** 일요일부터 7칸씩. 그 달이 아닌 칸은 null */
  weeks: (string | null)[][];
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
// 너무 긴 기간은 앞에서부터 이만큼의 달만 그린다.
const MAX_MONTHS = 6;

export function monthGrid(start: string, end: string): MonthGrid[] {
  const out: MonthGrid[] = [];
  let y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7));
  const lastKey = end.slice(0, 7);
  while (out.length < MAX_MONTHS) {
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const cells: (string | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1))];
    while (cells.length % 7) cells.push(null);
    const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
    const key = iso(y, m, 1).slice(0, 7);
    out.push({ key, year: y, month: m, weeks });
    if (key >= lastKey) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** 날짜만 UTC로 계산해 주간 이동이 서머타임이나 기기 시간대에 흔들리지 않게 한다. */
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekGrid(selected: string): string[] {
  const weekday = new Date(`${selected}T00:00:00Z`).getUTCDay();
  return Array.from({ length: 7 }, (_, index) => addDays(selected, index - weekday));
}

export function shiftWeek(selected: string, direction: -1 | 1, start: string, end: string): string {
  const next = addDays(selected, direction * 7);
  return next < start ? start : next > end ? end : next;
}
