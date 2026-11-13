import type { TripSettings, TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import { autoTitle } from "../../../src/domain/reservations/confirmation";
import { fromLocal, zonedDate } from "../../../src/domain/time/zoned";
import type { PageEntry } from "./model";
import { translate, type Lang } from "../i18n/strings";
import { zoneCity } from "./selectionOptions";
import { titleRepeatsRoute } from "./notebookView";
import { autofillSource, isStayAutofill } from "./bookingAutofill";

// 계획 탭의 하루 보기. 계획 속지·가져온 일정·예약을 한 줄 시간표로 합치고,
// 이웃한 두 줄 사이에 "빈 시간 / 출발까지 여유 / 겹침"을 계산한다.
// 시각은 모두 자정부터의 분(예: "13:40" → 820). 예약은 표에 적힌 현지 시각 그대로 쓴다.

// 이보다 비면 "빈 시간"으로 보여 준다(분).
const GAP_MIN = 60;
// 이동편 출발까지 이보다 적게 남으면 빠듯하다고 표시한다(분).
const TIGHT_MAX = 45;
// 날짜 줄이 끝없이 길어지지 않게 한다. 이보다 긴 여행은 앞부분만 보인다.
const MAX_DAYS = 60;

export interface TripDay {
  date: string;
  /** 1부터 시작하는 여행 몇째 날 */
  index: number;
  isToday: boolean;
}

export type TimelineItem = (
  | { kind: "plan"; id: string; title: string; detail: string; start?: number; end?: number; done: boolean; page: PageEntry }
  | { kind: "imported"; id: string; title: string; detail: string; start?: number; end?: number; done: false }
  | { kind: "move"; id: string; title: string; detail: string; start?: number; end?: number; endLabel?: string; done: false; reservation: Reservation }
  | { kind: "arrive"; id: string; title: string; detail: string; start?: number; end?: number; done: false; reservation: Reservation }
  | { kind: "booking"; id: string; title: string; detail: string; start?: number; end?: number; done: false; reservation: Reservation }
) & { startAt?: number; endAt?: number; timeZone?: string };

export type TimelineLink =
  | { kind: "gap"; minutes: number }
  | { kind: "until"; minutes: number; tight: boolean }
  | { kind: "overlap"; minutes: number };

export interface DayPlan {
  /** 시각이 있는 줄(시간순) */
  timed: TimelineItem[];
  /** links[i]는 timed[i]와 timed[i+1] 사이. 계산할 근거가 없으면 null */
  links: (TimelineLink | null)[];
  /** 시각을 정하지 않은 계획 */
  untimed: TimelineItem[];
  /** 그날 밤 묵는 숙소 */
  sleep?: Reservation;
}

import { clock, toMinutes } from "./timeOfDay";
export { clock, toMinutes };

/** 예약·도착 시각이 여행 시간대와 다르면 해당 현지 도시를 짧게 붙인다. */
export function timeZoneLabel(item: TimelineItem, tripZone: string, lang: Lang): string {
  return item.timeZone && item.timeZone !== tripZone ? zoneCity(item.timeZone, lang) : "";
}

// 저장된 현지 날짜·시각을 실제 순간으로 바꾼다. DST에 없는/중복된 시각은 추측하지 않는다.
function instant(date: string | undefined, time: string | undefined, timeZone: string): number | undefined {
  if (!date || !time) return undefined;
  try {
    return Date.parse(fromLocal(date, time, timeZone));
  } catch {
    return undefined;
  }
}

function withInstants(item: TimelineItem, date: string, tripZone: string): TimelineItem {
  if (item.kind === "imported") return item;
  const reservation = item.kind === "plan" ? undefined : item.reservation;
  const zone = (item.kind === "arrive" ? reservation?.endTimeZone : reservation?.timeZone) || tripZone;
  const localDate = item.kind === "arrive" ? reservation?.endDate : reservation?.startDate ?? date;
  const startAt = instant(localDate, item.start === undefined ? undefined : clock(item.start), zone);
  let endAt: number | undefined;
  if (item.kind === "plan" && startAt !== undefined && item.end !== undefined) {
    endAt = startAt + (item.end - item.start!) * 60_000;
  } else if (reservation && item.kind !== "arrive" && reservation.endTime) {
    endAt = instant(reservation.endDate ?? reservation.startDate, reservation.endTime, reservation.endTimeZone || reservation.timeZone || tripZone);
    if (endAt !== undefined && startAt !== undefined && endAt < startAt) endAt = undefined;
  } else if (item.kind === "arrive") {
    endAt = startAt;
  }
  return { ...item, startAt, endAt, timeZone: zone };
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export function tripDays(settings: TripSettings, now: Date): TripDay[] {
  const today = zonedDate(now, settings.timeZone);
  const count = Math.min(MAX_DAYS, Math.max(1, dayDiff(settings.startDate, settings.endDate) + 1));
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.parse(`${settings.startDate}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    return { date, index: i + 1, isToday: date === today };
  });
}

function route(r: Reservation, lang: Lang) {
  return r.departure || r.arrival ? `${r.departure || translate(lang, "plan.from")} → ${r.arrival || translate(lang, "plan.to")}` : r.title;
}

export function dayPlan(trip: TripWorkspace, pages: PageEntry[], date: string, lang: Lang = "ko"): DayPlan {
  const items: TimelineItem[] = [];
  for (const p of pages) {
    if (p.tripId !== trip.id || p.kind !== "plan" || p.date !== date) continue;
    const start = toMinutes(p.time);
    items.push({
      kind: "plan",
      id: `page-${p.id}`,
      title: p.title,
      detail: p.address || p.body.split("\n")[0] || "",
      start,
      end: start !== undefined && p.minutes ? start + p.minutes : undefined,
      done: p.done,
      page: p,
    });
  }
  for (const a of trip.schedule.activities) {
    if (zonedDate(a.targetAt, trip.settings.timeZone) !== date) continue;
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: trip.settings.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(a.targetAt));
    const start = toMinutes(local);
    items.push({ kind: "imported", id: `schedule-${a.id}`, title: a.title, detail: a.placeName || a.notes || "", start, end: start !== undefined && a.durationMinutes ? start + a.durationMinutes : undefined, startAt: Date.parse(a.targetAt), endAt: a.durationMinutes ? Date.parse(a.targetAt) + a.durationMinutes * 60_000 : undefined, timeZone: trip.settings.timeZone, done: false });
  }
  let sleep: Reservation | undefined;
  for (const r of trip.reservations ?? []) {
    if (r.kind === "stay") {
      if (r.startDate <= date && (r.endDate ? date < r.endDate : date === r.startDate)) sleep ??= r;
      continue;
    }
    const start = toMinutes(r.startTime);
    if (r.startDate === date) {
      if (r.kind === "activity") {
        items.push({ kind: "booking", id: `res-${r.id}`, title: r.title, detail: r.address || "", start, end: toMinutes(r.endTime), done: false, reservation: r });
        continue;
      }
      // 같은 날 같은 시간대에 내리면 도착 시각까지 이어서 계산한다. 다른 날이나 다른 시간대면 표시만 한다.
      const sameDay = !r.endDate || r.endDate === date;
      const sameZone = !r.endTimeZone || r.endTimeZone === r.timeZone;
      const endMinutes = toMinutes(r.endTime);
      const offset = r.endDate ? dayDiff(date, r.endDate) : 0;
      const routeTitle = route(r, lang);
      const customTitle = r.title !== routeTitle && r.title !== autoTitle(r) && !titleRepeatsRoute(r) ? r.title : "";
      items.push({
        kind: "move",
        id: `res-${r.id}`,
        title: routeTitle,
        // 자동 제목(편명·경로)은 빼고, 사용자가 고친 제목에 편명이 들어 있으면 편명을 두 번 적지 않는다.
        detail: [customTitle && r.serviceNumber && customTitle.includes(r.serviceNumber) ? "" : r.serviceNumber, customTitle].filter(Boolean).join(" · "),
        start,
        end: sameDay && sameZone ? endMinutes : undefined,
        endLabel: r.endTime ? `${offset > 0 ? `+${offset} ` : ""}${r.endTime}` : undefined,
        done: false,
        reservation: r,
      });
    } else if (r.kind !== "activity" && r.endDate === date) {
      // 전날 출발해 오늘 도착하는 이동편(예: 밤 비행기)은 도착 시각에 한 줄로 보인다.
      items.push({ kind: "arrive", id: `arr-${r.id}`, title: translate(lang, "plan.arrive", { place: r.arrival || r.title }), detail: r.serviceNumber || "", start: toMinutes(r.endTime), end: toMinutes(r.endTime), done: false, reservation: r });
    }
  }
  const resolved = items.map(item => withInstants(item, date, trip.settings.timeZone));
  const timed = resolved.filter((i) => i.startAt !== undefined).sort((a, b) => a.startAt! - b.startAt! || (a.kind === "move" ? 1 : 0) - (b.kind === "move" ? 1 : 0));
  const untimed = resolved.filter((i) => i.startAt === undefined);
  const links = timed.slice(0, -1).map((a, i) => linkBetween(a, timed[i + 1]));
  return { timed, links, untimed, sleep };
}

/**
 * 개요 맨 위 "다음 일정" 카드에 띄울 줄. 진행 중인 줄은 끝날 때까지 남기고, 끝낸 줄은 건너뛴다.
 * 끝 시각을 모르는 줄은 시작이 지나면 넘긴다. 비교는 각 항목의 실제 순간을 쓴다.
 */
export function nextUp(plan: DayPlan, now: Date): TimelineItem | undefined {
  return plan.timed.find((item) => !item.done && Math.max(item.endAt ?? item.startAt!, item.startAt!) >= now.getTime());
}

/** 개요의 '오늘'은 계획은 여행 시간대, 예약은 각 예약 시간대의 현재 날짜로 고른다. */
export function todayPlan(trip: TripWorkspace, pages: PageEntry[], now: Date, lang: Lang = "ko"): DayPlan {
  const tripDate = zonedDate(now, trip.settings.timeZone);
  const previousTripDate = new Date(Date.parse(`${tripDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const dates = new Set([tripDate, previousTripDate]);
  for (const r of trip.reservations ?? []) {
    if (r.kind === "stay") continue;
    dates.add(zonedDate(now, r.timeZone || trip.settings.timeZone));
    if (r.endDate) dates.add(zonedDate(now, r.endTimeZone || r.timeZone || trip.settings.timeZone));
    const startAt = instant(r.startDate, r.startTime, r.timeZone || trip.settings.timeZone);
    const endAt = instant(r.endDate, r.endTime, r.endTimeZone || r.timeZone || trip.settings.timeZone);
    if (startAt !== undefined && endAt !== undefined && startAt <= now.getTime() && now.getTime() <= endAt) dates.add(r.startDate);
  }
  const seen = new Set<string>();
  const items = [...dates].flatMap(date => {
    const plan = dayPlan(trip, pages, date, lang);
    return [...plan.timed, ...plan.untimed].filter(item => {
      if (seen.has(item.id)) return false;
      const currentDate = zonedDate(now, item.timeZone || trip.settings.timeZone);
      const active = item.startAt !== undefined && item.endAt !== undefined && item.startAt <= now.getTime() && now.getTime() <= item.endAt;
      const belongsToday = item.kind === "plan" || item.kind === "imported" ? date === tripDate : date === currentDate;
      if (belongsToday || active) seen.add(item.id);
      return belongsToday || active;
    });
  });
  const timed = items.filter(item => item.startAt !== undefined).sort((a, b) => a.startAt! - b.startAt!);
  return { timed, untimed: items.filter(item => item.startAt === undefined), links: timed.slice(0, -1).map((item, i) => linkBetween(item, timed[i + 1])) };
}

// 앞 줄이 끝나는 시각을 모르면(머무는 시간 미입력) 계산하지 않는다. 추측한 여유는 오히려 위험하다.
function linkBetween(a: TimelineItem, b: TimelineItem): TimelineLink | null {
  if (a.endAt === undefined || b.startAt === undefined) return null;
  const diff = Math.round((b.startAt - a.endAt) / 60_000);
  if (diff < 0) return { kind: "overlap", minutes: -diff };
  if (b.kind === "move") return { kind: "until", minutes: diff, tight: diff <= TIGHT_MAX };
  return diff >= GAP_MIN ? { kind: "gap", minutes: diff } : null;
}

export interface StayEvent {
  kind: "checkIn" | "checkOut";
  reservation: Reservation;
  time?: string;
}

/** 그날 들어가고 나오는 숙소. 하루 순서대로 체크아웃을 먼저 둔다. */
export function stayEvents(reservations: Reservation[], date: string): StayEvent[] {
  const events = reservations
    .filter((r) => r.kind === "stay" && (r.startDate === date || r.endDate === date))
    .map((r): StayEvent => (r.startDate === date ? { kind: "checkIn", reservation: r, time: r.startTime } : { kind: "checkOut", reservation: r, time: r.endTime }));
  return [...events.filter((e) => e.kind === "checkOut"), ...events.filter((e) => e.kind === "checkIn")];
}

/** 날짜 줄에 보일 그날 일정 수(계획·가져온 일정·이동·예약 입장) */
export function dayCounts(trip: TripWorkspace, pages: PageEntry[], days: TripDay[]): Record<string, number> {
  return Object.fromEntries(
    days.map((d) => {
      const plan = dayPlan(trip, pages, d.date);
      return [d.date, plan.timed.length + plan.untimed.length];
    }),
  );
}

/** 계획 탭 지도에 찍을 곳 하나. 장소 ID나 주소가 있어야 위치를 찾을 수 있다. */
export interface MapTarget {
  id: string;
  title: string;
  placeId?: string;
  address?: string;
  /** 누르면 열 것 */
  open: { kind: "page"; page: PageEntry } | { kind: "reservation"; reservation: Reservation };
}

/** 그날 지도에 찍을 곳. 시각 순서(번호 순서)대로, 시각 없는 계획 다음에 그날 밤 숙소를 마지막에 둔다. */
export function mapTargets(plan: DayPlan): MapTarget[] {
  const targets: MapTarget[] = [];
  for (const item of [...plan.timed, ...plan.untimed]) {
    if (item.kind === "plan" && (item.page.placeId || item.page.address.trim()))
      targets.push({ id: item.id, title: item.title, placeId: item.page.placeId, address: item.page.address.trim() || undefined, open: { kind: "page", page: item.page } });
    else if (item.kind === "booking" && item.reservation.address?.trim())
      targets.push({ id: item.id, title: item.title, address: item.reservation.address.trim(), open: { kind: "reservation", reservation: item.reservation } });
  }
  const sleep = plan.sleep;
  // 이 숙소의 자동 체크인·체크아웃 줄이 같은 주소로 찍혀 있으면 숙소 핀을 두 번 찍지 않는다.
  // 사용자가 쓴 계획(예: 호텔 조식)은 주소가 같아도 숙소 핀을 남긴다. 추천 기준점이 sleep- 핀을 찾기 때문이다.
  const sleepAddress = sleep?.address?.trim();
  const stayLine = (t: MapTarget) =>
    t.open.kind === "page" && isStayAutofill(t.open.page.id) && autofillSource(t.open.page.id)?.reservationId === sleep?.id && t.address === sleepAddress;
  if (sleep && sleepAddress && !targets.some((t) => (t.open.kind === "reservation" && t.open.reservation.id === sleep.id) || stayLine(t)))
    targets.push({ id: `sleep-${sleep.id}`, title: sleep.title, address: sleepAddress, open: { kind: "reservation", reservation: sleep } });
  return targets;
}
