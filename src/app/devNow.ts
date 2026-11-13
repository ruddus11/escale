/** 개발 서버에서만 쓰는 시각 고정: `?now=2026-07-21T10:00:00+09:00` */
export function readDevNow(search: string): Date | undefined {
  const value = new URLSearchParams(search).get("now");
  if (value === null) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
