import type { Reservation } from "../../../src/domain/reservations/types";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { isCurrentStay, sortedReservations } from "../../../src/domain/reservations/reservations";
import { fromLocal, localDateTime, zonedDate } from "../../../src/domain/time/zoned";
import type { PageEntry } from "./model";
import type { Lang } from "../i18n/strings";
import { nextFlight } from "./airportTime";
import { dayPlan, nextUp, todayPlan, tripDays, type DayPlan, type TimelineItem } from "./dayPlan";
import type { TravelMode } from "./travelMode";

export type OverviewItem = { kind: "flight"; reservation: Reservation } | { kind: "schedule"; item: TimelineItem };
export type OverviewStay = { stay: Reservation; when: "tonight" | "checkout" | "upcoming" };

/** 오늘 이후의 시각 있는 일정도 찾되, 시간대 경계에서 오늘 이미 잡힌 예약은 중복하지 않는다. */
export function overviewPlan(trip: TripWorkspace, pages: PageEntry[], now: Date, lang: Lang = "ko"): DayPlan {
  const current = todayPlan(trip, pages, now, lang);
  const today = zonedDate(now, trip.settings.timeZone);
  const seen = new Set(current.timed.map((item) => item.id));
  const later = tripDays(trip.settings, now).filter((day) => day.date > today).flatMap((day) => dayPlan(trip, pages, day.date, lang).timed).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return { ...current, timed: [...current.timed, ...later].sort((first, second) => first.startAt! - second.startAt!) };
}

/**
 * 개요와 여행 도구가 함께 쓰는 숙소 한 줄. 오늘 밤 묵을 곳이 기본이고, 없으면 다음 체크인이다.
 * 숙소를 옮기는 날에는 퇴실 전까지 이전 숙소를 보여 준다. 퇴실 시각이 없으면 언제 나갔는지 모르므로
 * 다음 숙소의 체크인 시각이 지나면 넘어간다. 끝난 숙소는 고르지 않는다.
 */
export function overviewStay(reservations: Reservation[], now: Date): OverviewStay | undefined {
  const stays = sortedReservations(reservations).filter((r) => r.kind === "stay");
  const today = (r: Reservation) => zonedDate(now, r.timeZone);
  const tonight = stays.find((r) => r.startDate <= today(r) && (r.endDate ? r.endDate > today(r) : r.startDate === today(r)));
  const leaving = stays.find((r) => isCurrentStay(r, now) && r.endDate === zonedDate(now, r.endTimeZone ?? r.timeZone));
  const checkedIn = !!tonight && localDateTime(now, tonight.timeZone).slice(0, 16) >= `${tonight.startDate}T${tonight.startTime ?? "00:00"}`;
  if (leaving && (leaving.endTime || !checkedIn)) return { stay: leaving, when: "checkout" };
  if (tonight) return { stay: tonight, when: "tonight" };
  const next = stays.find((r) => r.startDate > today(r));
  return next && { stay: next, when: "upcoming" };
}

/** 출발 전에는 항공편을, 여행 중에는 24시간 이내 항공편이나 오늘의 시각 있는 일정을 우선한다. */
export function pickNowNext(reservations: Reservation[], plan: DayPlan, now: Date, phase: string, mode: TravelMode): OverviewItem[] {
  if (phase === "after") return [];
  const flight = nextFlight(reservations, now);
  const secondFlight = flight ? nextFlight(reservations.filter((r) => r.id !== flight.id), now) : undefined;
  const schedules = plan.timed.filter((item) => !item.done && Math.max(item.endAt ?? item.startAt!, item.startAt!) >= now.getTime() &&
    !(item.kind !== "plan" && item.kind !== "imported" && item.reservation.kind === "flight"));
  const nextSchedule = nextUp({ ...plan, timed: schedules }, now);
  let imminent = false;
  if (flight) {
    try {
      imminent = !!flight.startTime && Date.parse(fromLocal(flight.startDate, flight.startTime, flight.timeZone)) - now.getTime() <= 86_400_000;
    } catch { imminent = false; }
  }
  const flightFirst = !!flight && (phase === "before" || imminent || !nextSchedule);
  const candidates: OverviewItem[] = flightFirst
    ? [{ kind: "flight", reservation: flight! }, ...(secondFlight ? [{ kind: "flight" as const, reservation: secondFlight }] : []), ...schedules.map((item) => ({ kind: "schedule" as const, item }))]
    : [...schedules.map((item) => ({ kind: "schedule" as const, item })), ...(flight ? [{ kind: "flight" as const, reservation: flight }] : [])];
  return candidates.slice(0, 2);
}
