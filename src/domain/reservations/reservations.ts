import { fromLocal, isTimeZone, localDateTime } from "../time/zoned";
import { isDateOnly, isIsoDateTime, isNonEmptyString, isRecordWithOnlyKeys } from "../../repositories/schemaGuards";
import type { Reservation, ReservationKind } from "./types";

export const reservationKinds: Record<ReservationKind, string> = { stay: "숙소", flight: "항공", transport: "기차·버스", activity: "입장·체험" };
const keys = ["id", "kind", "title", "startDate", "startTime", "timeZone", "endDate", "endTime", "endTimeZone", "address", "departure", "arrival", "serviceNumber", "note", "sourceUrl", "updatedAt", "verifiedAt"];
const optionalText = { address: 300, departure: 120, arrival: 120, serviceNumber: 40, note: 400 } as const;
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** 개별 예약 URL에 들어 있는 비밀정보를 보관하지 않도록 홈페이지 주소만 받는다. */
export function reservationServiceUrl(value: string): string | undefined {
  try {
    if (value.length > 500) return undefined;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        url.pathname !== "/" || url.port || !url.hostname.includes(".") ||
        /(^localhost$|\.local$|\.localhost$|^\d+(\.\d+){3}$|:)/i.test(url.hostname)) return undefined;
    return url.origin + "/";
  } catch { return undefined; }
}

export function validateReservation(value: Reservation): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(value.title, 120)) issues.push("예약 이름을 입력해 주세요.");
  if (!isDateOnly(value.startDate)) issues.push("시작 날짜를 확인해 주세요.");
  if (!isTimeZone(value.timeZone) || (value.endTimeZone !== undefined && !isTimeZone(value.endTimeZone))) issues.push("현지 시간대를 확인해 주세요.");
  if (value.startTime !== undefined && !isTime(value.startTime)) issues.push("시작 시각을 확인해 주세요.");
  if (value.endDate !== undefined && !isDateOnly(value.endDate)) issues.push("종료 날짜를 확인해 주세요.");
  if (value.endTime !== undefined && (!value.endDate || !isTime(value.endTime))) issues.push("종료 시각과 날짜를 함께 확인해 주세요.");
  if (value.sourceUrl !== undefined && !reservationServiceUrl(value.sourceUrl)) issues.push("예약 서비스의 https 홈페이지 주소만 넣어 주세요. 개별 예약 링크는 저장하지 않아요.");
  for (const [key, max] of Object.entries(optionalText)) {
    const text = value[key as keyof typeof optionalText];
    if (text !== undefined && (typeof text !== "string" || text.length > max)) issues.push("주소와 메모의 길이를 확인해 주세요.");
  }
  if (issues.length) return issues;
  try {
    if (value.startTime) fromLocal(value.startDate, value.startTime, value.timeZone);
    if (value.endDate && value.endTime) fromLocal(value.endDate, value.endTime, value.endTimeZone ?? value.timeZone);
    if (value.endDate) {
      if (value.startTime && value.endTime) {
        const start = Date.parse(fromLocal(value.startDate, value.startTime, value.timeZone));
        const end = Date.parse(fromLocal(value.endDate, value.endTime, value.endTimeZone ?? value.timeZone));
        if (end < start) issues.push("종료는 시작 이후여야 해요. 현지 날짜와 시간대를 확인해 주세요.");
      } else if (value.endDate < value.startDate) issues.push("종료 날짜가 더 이르면 출발·도착 시각과 시간대를 모두 입력해 주세요.");
    }
  } catch { issues.push("현지 시간 변경으로 없거나 두 번 나타나는 시각이에요. 예약 원본의 시각을 확인해 주세요."); }
  return issues;
}

export function isReservation(value: unknown): value is Reservation {
  if (!isRecordWithOnlyKeys(value, keys) || !isNonEmptyString(value.id, 120) ||
      typeof value.kind !== "string" || !Object.hasOwn(reservationKinds, value.kind) ||
      !isNonEmptyString(value.title, 120) || !isDateOnly(value.startDate) || !isTimeZone(value.timeZone) ||
      !isIsoDateTime(value.updatedAt) || (value.verifiedAt !== undefined && !isIsoDateTime(value.verifiedAt))) return false;
  // 런타임 입력은 문자열 검사를 먼저 거쳐 날짜 변환 함수에 넘긴다.
  for (const key of ["startTime", "endTime", "endDate", "endTimeZone", "sourceUrl"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") return false;
  }
  return validateReservation(value as unknown as Reservation).length === 0;
}

export function isReservationList(value: unknown): value is Reservation[] {
  return Array.isArray(value) && value.length <= 100 && value.every(isReservation) && new Set(value.map(r => r.id)).size === value.length;
}

export function sortedReservations(reservations: Reservation[]): Reservation[] {
  return reservations.map(item => ({ item, time: startInstant(item) }))
    .sort((a, b) => a.time - b.time).map(({ item }) => item);
}

function startInstant(r: Reservation): number {
  if (r.startTime) return Date.parse(fromLocal(r.startDate, r.startTime, r.timeZone));
  return Date.parse(r.startDate + "T12:00:00Z");
}

export function isCurrentStay(r: Reservation, now: Date): boolean {
  if (r.kind !== "stay" || !r.endDate) return false;
  const local = localDateTime(now, r.timeZone).slice(0, 16);
  const endLocal = localDateTime(now, r.endTimeZone ?? r.timeZone).slice(0, 16);
  return local >= `${r.startDate}T${r.startTime ?? "00:00"}` && endLocal < `${r.endDate}T${r.endTime ?? "23:59"}`;
}

export function selectQuickReservations(reservations: Reservation[], now: Date): Reservation[] {
  const sorted = sortedReservations(reservations);
  const current = sorted.filter(r => isCurrentStay(r, now));
  const today = sorted.filter(r => {
    const local = localDateTime(now, r.timeZone).slice(0, 16);
    return r.kind !== "stay" && r.startDate === local.slice(0, 10);
  });
  const upcoming = sorted.filter(r => `${r.startDate}T${r.startTime ?? "23:59"}` >= localDateTime(now, r.timeZone).slice(0, 16));
  return [...new Map([...current, ...today, ...upcoming].map(r => [r.id, r])).values()].slice(0, 3);
}
