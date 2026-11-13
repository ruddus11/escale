// 하루 안의 시각을 자정부터의 분으로 다룬다. 예: "13:40" ↔ 820. 여러 계산 모듈이 함께 쓴다.

export function toMinutes(time: string | undefined): number | undefined {
  const m = time ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
