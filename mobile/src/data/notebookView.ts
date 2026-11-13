import type { TripExpense,TripSettings,TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import { convertToBase } from "../../../src/domain/money/currency";
import { zonedDate } from "../../../src/domain/time/zoned";
import { sortedReservations } from "../../../src/domain/reservations/reservations";
import { localDateTime } from "../../../src/domain/time/zoned";
import type { PageEntry } from "./model";
import { dailyBudgetOf } from "./budgetPlan";
import { translate,type Key,type Lang } from "../i18n/strings";
import { zoneCity } from "./selectionOptions";

const dayCount = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
export function shortDate(date: string, year = false) {
  return `${year ? `${date.slice(0, 4)}.` : ""}${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}
export function notebookDay(settings: TripSettings, now: Date) {
  const today = zonedDate(now, settings.timeZone);
  const phase = today < settings.startDate ? "before" : today > settings.endDate ? "after" : "during";
  const date = phase === "before" ? settings.startDate : phase === "after" ? settings.endDate : today;
  // total은 여행 전체 일수(시작일·마지막 날 포함). "Day 6 / 11" 표시에 쓴다.
  return { phase, today, date, day: dayCount(settings.startDate, date) + 1, total: dayCount(settings.startDate, settings.endDate) + 1, until: dayCount(today, settings.startDate) };
}
export function plansForDate(trip: TripWorkspace, pages: PageEntry[], date: string) {
  return [
    ...pages.filter(p => p.tripId === trip.id && p.kind === "plan" && p.date === date).map(p => ({id:`page-${p.id}`,title:p.title,detail:p.address || p.body,done:p.done,page:p})),
    ...trip.schedule.activities.filter(a => zonedDate(a.targetAt,trip.settings.timeZone) === date).map(a => ({id:`schedule-${a.id}`,title:a.title,detail:a.placeName || a.notes || "",done:false,page:undefined})),
  ];
}
export function latestJournal(pages: PageEntry[]) {
  return pages.filter(p => p.kind === "journal").sort((a,b) => b.date.localeCompare(a.date))[0];
}
/** 예약 카드 아래 한두 줄. 숙소는 기간과 체크인·아웃, 이동편은 경로와 시각. */
export function reservationSummary(r: Reservation, lang: Lang = "ko") {
  const tr = (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const crossYear = !!r.endDate && r.startDate.slice(0,4) !== r.endDate.slice(0,4);
  const start = shortDate(r.startDate,crossYear);
  if (r.kind === "stay") {
    const nights = r.endDate ? dayCount(r.startDate,r.endDate) : 0;
    const period = r.endDate ? `${start} — ${shortDate(r.endDate,crossYear)} · ${tr(nights === 1 ? "sum.night" : "sum.nights", { n: nights })}` : `${start} · ${tr("sum.noCheckOut")}`;
    return `${period}${r.startTime ? `\n${tr("sum.checkIn", { time: r.startTime })}` : ""}${r.endTime ? ` · ${tr("sum.checkOut", { time: r.endTime })}` : ""}`;
  }
  // 시간대가 다르면 "Asia/Tokyo" 대신 "도쿄 시각"처럼 도시 이름으로 적는다.
  const zone = (z: string) => z && r.endTimeZone && r.endTimeZone !== r.timeZone ? ` (${tr("res.zoneTime", { city: zoneCity(z, lang) })})` : "";
  const departure = `${start}${r.startTime ? ` ${r.startTime}` : ` · ${tr("res.noTime")}`}${zone(r.timeZone)}`;
  const arrival = r.endDate ? ` → ${shortDate(r.endDate,crossYear)}${r.endTime ? ` ${r.endTime}` : ` · ${tr("res.noTime")}`}${zone(r.endTimeZone ?? r.timeZone)}` : "";
  // 제목에 출발지와 도착지가 실제 이동 순서로 들어 있을 때만 경로 줄을 생략한다.
  const departureIndex = r.departure ? r.title.indexOf(r.departure) : -1;
  const routeInTitle = departureIndex >= 0 && !!r.arrival && r.title.indexOf(r.arrival, departureIndex + (r.departure?.length ?? 0)) >= 0;
  const route = (r.departure || r.arrival) && !routeInTitle ? `${r.departure || tr("sum.noFrom")} → ${r.arrival || tr("sum.noTo")}\n` : "";
  return `${route}${departure}${arrival}`;
}
/**
 * 제목이 편명·출발지·도착지와 구분 기호만으로 이루어졌는지. 예약 읽기가 붙인 제목은
 * 읽은 경로마다 구분자가 달라("RF318 · CJJ → KIX", "RF318 CJJ→KIX") 문자열 비교로는 놓친다.
 */
export function titleRepeatsRoute(r: Pick<Reservation, "title" | "serviceNumber" | "departure" | "arrival">) {
  let rest = r.title;
  for (const part of [r.serviceNumber, r.departure, r.arrival]) if (part) rest = rest.split(part).join("");
  return rest.replace(/[\s·・\-–—→>~|/,]+/g, "") === "";
}
export function expenseGroups(trip: TripWorkspace) {
  const groups = new Map<string, {date:string;total:number;items:TripExpense[]}>();
  for (const item of [...trip.ledger.expenses].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))) {
    const date = zonedDate(item.occurredAt,trip.settings.timeZone);
    const group = groups.get(date) ?? {date,total:0,items:[]};
    group.total += convertToBase(item,trip.settings.baseCurrency);
    group.items.push(item);
    groups.set(date,group);
  }
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
/** 오늘(현지 날짜) 쓴 돈과 하루 예산(직접 정한 값, 없으면 총예산 ÷ 일수). */
export function todaySpending(trip: TripWorkspace, date: string) {
  const spent = expenseGroups(trip).find(g => g.date === date)?.total ?? 0;
  return { spent, dailyBudget: dailyBudgetOf(trip) };
}
/** 출발까지 남은 때. 화면에서 언어에 맞춰 문구로 바꾼다. */
export type Until =
  | { kind: "moving" }
  | { kind: "days"; days: number }
  | { kind: "today" }
  | { kind: "soon"; hours: number; minutes: number };

/** 오늘 탭 맨 위에 띄울 다음 이동편(항공·기차·버스). 도착 전까지는 계속 보여준다. */
export function nextJourney(reservations: Reservation[], now: Date) {
  for (const r of sortedReservations(reservations)) {
    if (r.kind !== "flight" && r.kind !== "transport") continue;
    const local = localDateTime(now, r.timeZone).slice(0, 16);
    const start = `${r.startDate}T${r.startTime ?? "23:59"}`;
    const end = r.endDate && r.endTime ? `${r.endDate}T${r.endTime}` : start;
    const endLocal = localDateTime(now, r.endTimeZone ?? r.timeZone).slice(0, 16);
    if (local > start && endLocal > end) continue;
    if (local >= start && r.startTime) return { reservation: r, until: { kind: "moving" } as Until };
    const days = dayCount(local.slice(0, 10), r.startDate);
    if (days > 0) return { reservation: r, until: { kind: "days", days } as Until };
    if (!r.startTime) return { reservation: r, until: { kind: "today" } as Until };
    const minutes = Math.round((Date.parse(`${start}:00Z`) - Date.parse(`${local}:00Z`)) / 60000);
    return { reservation: r, until: { kind: "soon", hours: Math.floor(minutes / 60), minutes: minutes % 60 } as Until };
  }
  return undefined;
}
