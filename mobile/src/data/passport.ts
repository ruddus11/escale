import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { zonedDate } from "../../../src/domain/time/zoned";
import { countryForZone, type StampCountry } from "./stampCountries";
import { zoneCity } from "./selectionOptions";
import type { Lang } from "../i18n/strings";

// 여권 도장. 성공 완료를 확인하고 귀국일(여행 시간대의 마지막 날)이 되면 그 여행에서 머문 나라마다 도장을 한 번 찍는다.
// - 나라: 여행 시간대 + 숙소 예약의 시간대. 항공편 도착지는 귀국편도 있어 넣지 않는다.
// - 한 번만: 도장 id는 "여행 id:나라 코드"다. 앱을 다시 열거나 날짜를 바꿔도 같은 도장을 또 찍지 않는다.
//   같은 나라를 다른 여행으로 다시 가면 별도 도장이다.
// - 취소한 여행은 성공한 여행이 아니므로 찍지 않고, 이미 찍힌 도장도 거둔다.
// 발급 기록은 수첩 데이터와 따로 이 기기의 설정 표(app_settings)에 둔다. 기존 여행·일기 데이터는 바꾸지 않는다.

export interface PassportStamp {
  id: string;
  tripId: string;
  tripTitle: string;
  /** ISO 국가 코드 */
  country: string;
  city: string;
  /** 귀국일 YYYY-MM-DD */
  date: string;
  issuedAt: string;
}

export interface PassportState {
  stamps: PassportStamp[];
  /** 취소로 표시한 여행 id */
  cancelled: string[];
  /** 사용자가 성공 완료를 확인한 여행 id */
  completed: string[];
}

export const emptyPassport = (): PassportState => ({ stamps: [], cancelled: [], completed: [] });

export interface TripCountry {
  country: StampCountry;
  city: string;
}

/** 여행이 머문 나라와 대표 도시. 같은 나라는 한 번만. 첫 줄이 여행의 주 나라다. */
export function tripCountries(trip: TripWorkspace, lang: Lang = "ko"): TripCountry[] {
  const out: TripCountry[] = [];
  const add = (zone: string, city: string) => {
    const country = countryForZone(zone);
    if (country && !out.some((c) => c.country.code === country.code)) out.push({ country, city });
  };
  const destination = (trip.settings.destination ?? "").split(/[,/·，、]/)[0]?.trim();
  add(trip.settings.timeZone, destination || zoneCity(trip.settings.timeZone, lang));
  for (const r of trip.reservations ?? []) if (r.kind === "stay") add(r.timeZone, zoneCity(r.timeZone, lang));
  return out;
}

/** 귀국일(여행 시간대 기준)이 왔는가. */
export function returnDayReached(trip: TripWorkspace, now: Date): boolean {
  return zonedDate(now, trip.settings.timeZone) >= trip.settings.endDate;
}

/**
 * 지금 찍을 도장을 더한 새 상태와 새로 찍힌 도장. 바뀐 것이 없으면 같은 state 객체를 돌려준다(저장 생략용).
 * 취소한 여행의 도장은 뺀다. 지운 여행의 도장은 기록으로 남긴다.
 */
export function issueStamps(trips: TripWorkspace[], state: PassportState, now: Date, lang: Lang = "ko"): { state: PassportState; issued: PassportStamp[] } {
  const cancelled = new Set(state.cancelled);
  const kept = state.stamps.filter((s) => !cancelled.has(s.tripId));
  const have = new Set(kept.map((s) => s.id));
  const issued: PassportStamp[] = [];
  for (const trip of trips) {
    if (cancelled.has(trip.id) || !state.completed.includes(trip.id) || !returnDayReached(trip, now)) continue;
    for (const { country, city } of tripCountries(trip, lang)) {
      const id = `${trip.id}:${country.code}`;
      if (have.has(id)) continue;
      have.add(id);
      issued.push({ id, tripId: trip.id, tripTitle: trip.settings.title, country: country.code, city, date: trip.settings.endDate, issuedAt: now.toISOString() });
    }
  }
  if (!issued.length && kept.length === state.stamps.length) return { state, issued };
  return { state: { ...state, stamps: [...kept, ...issued].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) }, issued };
}

export function setTripCancelled(state: PassportState, tripId: string, cancelled: boolean): PassportState {
  const rest = state.cancelled.filter((id) => id !== tripId);
  return { ...state, cancelled: cancelled ? [...rest, tripId] : rest, completed: cancelled ? state.completed.filter((id) => id !== tripId) : state.completed };
}

/** 완료 확인은 일기나 여행 원본을 바꾸지 않고 여권에만 저장한다. */
export function setTripCompleted(state: PassportState, tripId: string, completed: boolean): PassportState {
  if (state.cancelled.includes(tripId) && completed) return state;
  const rest = state.completed.filter((id) => id !== tripId);
  return { ...state, completed: completed ? [...rest, tripId] : rest };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 저장값 읽기. 모양이 틀린 줄은 버리고, 통째로 틀리면 빈 여권으로 시작한다(앱이 멈추지 않게). */
export function parsePassport(raw: string | null): PassportState {
  if (!raw) return emptyPassport();
  try {
    const value = JSON.parse(raw) as Partial<PassportState>;
    const stamps = Array.isArray(value.stamps)
      ? value.stamps.filter(
          (s): s is PassportStamp =>
            !!s && typeof s.id === "string" && typeof s.tripId === "string" && typeof s.tripTitle === "string" && typeof s.country === "string" && typeof s.city === "string" && typeof s.date === "string" && DATE.test(s.date) && typeof s.issuedAt === "string",
        )
      : [];
    const cancelled = Array.isArray(value.cancelled) ? value.cancelled.filter((id): id is string => typeof id === "string") : [];
    const completed = Array.isArray(value.completed) ? value.completed.filter((id): id is string => typeof id === "string" && !cancelled.includes(id)) : [];
    return { stamps, cancelled, completed };
  } catch {
    return emptyPassport();
  }
}
