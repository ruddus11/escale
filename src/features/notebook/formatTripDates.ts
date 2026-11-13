/** 수첩 표지·머리글의 날짜 표기. 예: "2026-10-12", "2026-10-16" → "10.12 – 16" */
export function formatTripDates(startDate: string, endDate: string): string {
  const [, startMonth, startDay] = startDate.split("-");
  const [, endMonth, endDay] = endDate.split("-");
  const start = `${Number(startMonth)}.${Number(startDay)}`;
  const end =
    startMonth === endMonth ? `${Number(endDay)}` : `${Number(endMonth)}.${Number(endDay)}`;
  return `${start} – ${end}`;
}
