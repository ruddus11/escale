import type { Reservation } from "../../../src/domain/reservations/types";
import { airports } from "../../../src/domain/reservations/confirmation";
import { sortedReservations } from "../../../src/domain/reservations/reservations";
import { fromLocal, localDateTime } from "../../../src/domain/time/zoned";
import type { Lang } from "../i18n/strings";

// 공항 도착 권장 시각. 여행 도구 답(TravelPouch)과 개요 카드가 같은 계산을 쓴다.
// 국제선은 출발 2시간 전, 국내선은 1시간 전. 공항까지 이동 시간은 저장된 값이 없으니 추측하지 않는다.
export const AIRPORT_LEAD_MINUTES = { international: 120, domestic: 60 } as const;

/** "청주 CJJ", "CJJ", "인천(ICN)", "도쿄 나리타 NRT" → 공항 표에 있는 세 글자 코드. */
export function airportCode(place?: string): string | undefined {
  for (const m of (place ?? "").toUpperCase().matchAll(/(?<![A-Z])([A-Z]{3})(?![A-Z])/g)) if (airports[m[1]!]) return m[1];
  return undefined;
}

/** 한국어 공항 이름: CJJ → "청주공항", KIX → "간사이공항". 표에 없으면 저장된 글자 그대로. */
export function airportName(place?: string): string | undefined {
  const code = airportCode(place);
  if (!code) return place?.trim() || undefined;
  return `${airports[code]!.city.split(/\s+/).at(-1)}공항`;
}

/** 화면에 쓰는 공항 이름. 공항 표에 한국어 이름만 있어 다른 언어는 세 글자 코드로 보여 준다. */
export function airportLabel(place: string | undefined, lang: Lang): string | undefined {
  return lang === "ko" ? airportName(place) : airportCode(place) ?? (place?.trim() || undefined);
}

/** 출발·도착 시간대(또는 두 공항의 시간대)가 다르면 국제선으로 본다. 모르면 국제선(더 여유 있게). */
export function isInternational(r: Reservation): boolean {
  const from = airportCode(r.departure), to = airportCode(r.arrival);
  if (from && to) return airports[from]!.timeZone !== airports[to]!.timeZone;
  if (r.endTimeZone) return r.endTimeZone !== r.timeZone;
  return true;
}

function departInstant(r: Reservation): number | undefined {
  if (!r.startTime) return undefined;
  try { return Date.parse(fromLocal(r.startDate, r.startTime, r.timeZone)); } catch { return undefined; }
}

/** 아직 출발하지 않은 가장 가까운 항공편. 시각이 없으면 그날(출발지 현지 날짜)이 지나기 전까지 남긴다. */
export function nextFlight(reservations: Reservation[], now: Date): Reservation | undefined {
  return sortedReservations(reservations).find((r) => {
    if (r.kind !== "flight") return false;
    const at = departInstant(r);
    if (at !== undefined) return at > now.getTime();
    return r.startDate >= localDateTime(now, r.timeZone).slice(0, 10);
  });
}

export interface AirportArrival {
  flight: Reservation;
  /** 출발 공항 이름(한국어). 모르면 undefined */
  airport?: string;
  international: boolean;
  leadMinutes: number;
  /** 출발 공항 현지 날짜·시각. 표시할 때는 r.timeZone의 도시 이름(서울/도쿄 시각)을 붙인다. */
  arriveDate?: string;
  arriveTime?: string;
  timeZone: string;
}

/** 항공편 하나의 공항 도착 권장 시각. 출발 시각이 없으면 arriveTime 없이 돌려준다. */
export function airportArrival(flight: Reservation): AirportArrival {
  const international = isInternational(flight);
  const leadMinutes = international ? AIRPORT_LEAD_MINUTES.international : AIRPORT_LEAD_MINUTES.domestic;
  const at = departInstant(flight);
  const base = { flight, airport: airportName(flight.departure), international, leadMinutes, timeZone: flight.timeZone };
  if (at === undefined) return base;
  const local = localDateTime(new Date(at - leadMinutes * 60_000), flight.timeZone);
  return { ...base, arriveDate: local.slice(0, 10), arriveTime: local.slice(11, 16) };
}

/** 다음 항공편과 그 공항 도착 권장 시각. 저장된 항공편이 없으면 undefined. */
export function nextAirportArrival(reservations: Reservation[], now: Date): AirportArrival | undefined {
  const flight = nextFlight(reservations, now);
  return flight ? airportArrival(flight) : undefined;
}
