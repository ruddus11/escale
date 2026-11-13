import type { Reservation } from "../../../src/domain/reservations/types";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { fromLocal, localDateTime } from "../../../src/domain/time/zoned";
import type { PageEntry } from "./model";
import { DEPARTURE_BUFFER, DOMESTIC_DEPARTURE_BUFFER, LANDING_BUFFER } from "./recommend";
import { translate, type Lang } from "../i18n/strings";

// 예약에서 일정 채우기. 숙소·항공 예약을 보고 계획 속지 초안을 만든다. 저장은 사용자가 고른 뒤에만 한다.
//   숙소: 체크인 날 체크인 시각, 체크아웃 날 체크아웃 시각에 한 줄씩.
//   여행지에 내리는 항공편: 도착 시각부터 LANDING_BUFFER(90분)짜리 "도착" 줄. 다음 일정과의 빈 시간은 도착 + 90분부터 생긴다.
//   여행지에서 떠나는 항공편: 출발 3시간(국내선 2시간) 전에 "공항으로 출발" 줄. 줄이 출발 시각에 끝난다.
// 시각은 모두 수첩(여행) 현지 시각으로 바꿔 넣는다. 계획 속지의 time이 수첩 현지 시각이기 때문이다.
//
// 표식: 새 칸을 만들지 않고 속지 id를 "booking-<역할>-<예약 id>"로 정한다(예: "booking-checkin-r1").
// 예전 앱도 id는 그대로 읽으므로 백업·동기화 형식이 바뀌지 않는다. 같은 id가 있으면 다시 만들지 않는다.
// 사용자가 이미 보고 넣었거나 거절한 제안은 기기 설정(handled)에 "id → 날짜|시각"으로만 남긴다.

export type AutofillRole = "checkIn" | "checkOut" | "arrive" | "airport";

const ROLE_TOKEN: Record<AutofillRole, string> = { checkIn: "checkin", checkOut: "checkout", arrive: "arrive", airport: "airport" };
const PREFIX = "booking-";
// 백업 검사(model.ts)의 속지 id 길이 제한.
const ID_MAX = 120;

/** 숙소 예약에 시각이 없을 때 쓰는 흔한 체크인·체크아웃 시각(숙소 현지). */
export const DEFAULT_CHECK_IN = "15:00";
export const DEFAULT_CHECK_OUT = "10:00";
/** 체크인·체크아웃 줄의 길이(분). 짐을 맡기거나 정산하는 정도로 잡는다. */
export const STAY_MINUTES = 30;

export function autofillId(role: AutofillRole, reservationId: string): string {
  return `${PREFIX}${ROLE_TOKEN[role]}-${reservationId}`;
}

/** 자동 채움으로 만든 속지 id면 역할과 예약 id를 돌려준다. */
export function autofillSource(pageId: string): { role: AutofillRole; reservationId: string } | undefined {
  if (!pageId.startsWith(PREFIX)) return undefined;
  for (const role of Object.keys(ROLE_TOKEN) as AutofillRole[]) {
    const head = `${PREFIX}${ROLE_TOKEN[role]}-`;
    if (pageId.startsWith(head) && pageId.length > head.length) return { role, reservationId: pageId.slice(head.length) };
  }
  return undefined;
}

/** 숙소 체크인·체크아웃 줄인지. 추천 기준점을 숙소로 맞출 때 쓴다. */
export function isStayAutofill(pageId: string): boolean {
  const role = autofillSource(pageId)?.role;
  return role === "checkIn" || role === "checkOut";
}

/** 예약 하나에서 나온 계획 한 줄. date·time은 수첩 현지 값이다. */
export interface PlannedLine {
  id: string;
  role: AutofillRole;
  reservationId: string;
  date: string;
  time?: string;
  minutes?: number;
  title: string;
  address: string;
  body: string;
}

export interface Suggestion extends PlannedLine {
  /** new: 아직 없는 줄, changed: 전에 넣은 줄의 날짜·시각이 예약과 달라졌다 */
  state: "new" | "changed";
  previous?: { date: string; time?: string };
  /** 기기에 남기는 "이 제안을 봤다" 값. 예: "2026-11-05|15:40" */
  signature: string;
}

/** 넣었거나 거절한 제안. 속지 id → signature. */
export type Handled = Record<string, string>;

export const signatureOf = (line: { date: string; time?: string }) => `${line.date}|${line.time ?? ""}`;

// 예약 현지 날짜·시각을 수첩 현지로. DST에 없는/겹치는 시각은 추측하지 않고 undefined.
// 예: 서울 09:00 → 수첩 Asia/Tokyo 09:00, 런던 08:00(겨울) → 수첩 Asia/Tokyo 17:00.
function toTripLocal(date: string, time: string, zone: string, tripZone: string, shiftMinutes = 0): { date: string; time: string } | undefined {
  if (zone === tripZone && !shiftMinutes) return { date, time };
  try {
    const local = localDateTime(new Date(Date.parse(fromLocal(date, time, zone)) + shiftMinutes * 60_000), tripZone);
    return { date: local.slice(0, 10), time: local.slice(11, 16) };
  } catch {
    return undefined;
  }
}

const clip = (text: string, max: number) => text.trim().slice(0, max);

function stayLines(r: Reservation, tripZone: string, lang: Lang): PlannedLine[] {
  const lines: PlannedLine[] = [];
  const name = r.title.trim();
  const add = (role: "checkIn" | "checkOut", date: string, saved: string | undefined, fallback: string) => {
    const at = toTripLocal(date, saved ?? fallback, r.timeZone, tripZone);
    if (!at) return;
    lines.push({
      id: autofillId(role, r.id),
      role,
      reservationId: r.id,
      date: at.date,
      time: at.time,
      minutes: STAY_MINUTES,
      title: clip(translate(lang, role === "checkIn" ? "autofill.item.checkIn" : "autofill.item.checkOut", { name }), 120),
      address: clip(r.address ?? "", 300),
      body: saved ? "" : translate(lang, "autofill.note.defaultTime", { time: fallback }),
    });
  };
  add("checkIn", r.startDate, r.startTime, DEFAULT_CHECK_IN);
  // 체크아웃 날짜는 예약 종료일. 숙소 시간대가 따로 적혀 있어도 체크인과 같은 곳이다.
  if (r.endDate) add("checkOut", r.endDate, r.endTime, DEFAULT_CHECK_OUT);
  return lines;
}

/** 항공편 하나에서 만들 줄. arrive: "도착" 줄, airport: "공항으로 출발" 줄, domestic: 국내선 문구와 2시간 규칙을 쓸지. */
interface FlightLeg {
  arrive: boolean;
  airport: boolean;
  domestic: boolean;
}

// "YYYY-MM-DD" 두 날짜 사이 일수. 예: 11/10 → 11/13 = 3.
const dayGap = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * 항공편마다 여행지에 들어오는 편인지, 떠나는 편인지, 여행 중 국내선인지 정한다.
 * 출발·도착 시간대가 다르면 시간대로 정한다. 도착 시간대가 수첩 시간대면 들어오는 편, 출발 시간대가 수첩 시간대면 떠나는 편.
 * 둘 다 수첩 시간대면 시간대로는 알 수 없다. 새 예약은 출발 시간대가 수첩 시간대이고 도착 시간대가 비어 있어서,
 * 서울→오사카처럼 시차 없는 편은 가는 편·오는 편 모두 이렇게 된다. 이때는 날짜와 순서로 정한다.
 *   - 가장 이른 편이 첫날까지 뜨면 들어오는 편: 도착 줄만.
 *   - 가장 늦은 편이 마지막 날부터 내리면 떠나는 편: 공항 줄만.
 *   (도착 시간대가 비어 있으면 첫날 다음 날·마지막 날 전날까지 하루 여유를 준다.)
 *   - 한 편이 둘 다에 해당하면(짧은 여행) 첫날·마지막 날 중 가까운 쪽. 같으면 들어오는 편.
 *   - 그 밖의 여행 중간 편은 여행지 안 국내선으로 보고 둘 다 만든다.
 * 귀국 편에 도착 줄을, 집에서 떠나는 편에 공항 줄을 만들지 않는 것이 목적이다.
 */
function flightLegs(flights: readonly Reservation[], trip: { startDate: string; endDate: string; timeZone: string }): Map<string, FlightLeg> {
  const order = [...flights].sort((a, b) => `${a.startDate} ${a.startTime ?? ""}`.localeCompare(`${b.startDate} ${b.startTime ?? ""}`));
  const first = order[0]?.id;
  const last = order[order.length - 1]?.id;
  const legs = new Map<string, FlightLeg>();
  for (const r of flights) {
    const from = r.timeZone;
    const to = r.endTimeZone || r.timeZone;
    if (from !== trip.timeZone || to !== trip.timeZone) {
      legs.set(r.id, { arrive: to === trip.timeZone, airport: from === trip.timeZone, domestic: false });
      continue;
    }
    // 도착 시간대를 따로 같은 값으로 적었으면 국내선이 분명하다. 이때는 첫날·마지막 날에 딱 맞을 때만 들고 나는 편으로 본다.
    // 비어 있으면 시간대를 안 고친 국제선일 가능성이 커서 하루 여유를 준다(예: 수첩은 11/10부터, 비행은 11/11).
    const slack = r.endTimeZone ? 0 : 1;
    const toStart = dayGap(trip.startDate, r.startDate);
    const toEnd = dayGap(r.endDate ?? r.startDate, trip.endDate);
    let inbound = r.id === first && toStart <= slack;
    let outbound = r.id === last && toEnd <= slack;
    if (inbound && outbound) {
      inbound = toStart <= toEnd;
      outbound = !inbound;
    }
    // 비어 있는 들고 나는 편은 집과 오가는 국제선으로 본다(입국 문구, 3시간). 여행 중 편은 국내선(2시간).
    const domestic = Boolean(r.endTimeZone) || (!inbound && !outbound);
    legs.set(r.id, { arrive: !outbound, airport: !inbound, domestic });
  }
  return legs;
}

/**
 * 항공편 줄. 어느 줄을 만들지는 flightLegs가 정한다.
 * 도착·출발 공항 주소는 넣지 않는다. 주소가 있으면 추천 기준점이 공항 쪽으로 끌려간다.
 */
function flightLines(r: Reservation, leg: FlightLeg, tripZone: string, lang: Lang): PlannedLine[] {
  const lines: PlannedLine[] = [];
  if (leg.arrive) {
    const date = r.endDate ?? r.startDate;
    lines.push({
      id: autofillId("arrive", r.id),
      role: "arrive",
      reservationId: r.id,
      date,
      // 도착 시각을 모르면 시간 미정으로 둔다. 항공 시각은 추측하지 않는다.
      ...(r.endTime ? { time: r.endTime, minutes: LANDING_BUFFER } : {}),
      title: clip(translate(lang, leg.domestic ? "autofill.item.arriveDomestic" : "autofill.item.arrive", { place: (r.arrival || r.title).trim() }), 120),
      address: "",
      body: translate(lang, leg.domestic ? "autofill.note.arriveDomestic" : "autofill.note.arrive", { n: LANDING_BUFFER }),
    });
  }
  if (leg.airport) {
    const lead = leg.domestic ? DOMESTIC_DEPARTURE_BUFFER : DEPARTURE_BUFFER;
    const at = r.startTime ? toTripLocal(r.startDate, r.startTime, r.timeZone, tripZone, -lead) : undefined;
    if (!r.startTime || at) {
      lines.push({
        id: autofillId("airport", r.id),
        role: "airport",
        reservationId: r.id,
        date: at?.date ?? r.startDate,
        ...(at ? { time: at.time, minutes: lead } : {}),
        title: clip(translate(lang, "autofill.item.airport", { flight: (r.serviceNumber || r.title).trim() }), 120),
        address: "",
        body: translate(lang, leg.domestic ? "autofill.note.airportDomestic" : "autofill.note.airportIntl", { n: lead / 60 }),
      });
    }
  }
  return lines;
}

/** 수첩의 숙소·항공 예약이 만드는 계획 줄 전부. 여행 날짜 밖의 줄은 날짜 줄에 보이지 않으므로 뺀다. */
export function plannedLines(trip: TripWorkspace, lang: Lang, reservationId?: string): PlannedLine[] {
  const { startDate, endDate, timeZone } = trip.settings;
  const reservations = trip.reservations ?? [];
  // 예약 하나만 물을 때도 가는 편·오는 편 판정은 수첩의 모든 항공편 순서로 한다.
  const legs = flightLegs(reservations.filter((r) => r.kind === "flight"), trip.settings);
  return reservations
    .filter((r) => !reservationId || r.id === reservationId)
    .flatMap((r) => {
      if (r.kind === "stay") return stayLines(r, timeZone, lang);
      const leg = r.kind === "flight" ? legs.get(r.id) : undefined;
      return leg ? flightLines(r, leg, timeZone, lang) : [];
    })
    .filter((line) => line.id.length <= ID_MAX && line.date >= startDate && line.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
}

const normalize = (text: string) => text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * 지금 물어볼 제안. 같은 줄이 이미 있으면(같은 id, 또는 같은 날 같은 제목의 계획) 묻지 않는다.
 * 전에 넣은 줄의 날짜·시각이 예약과 다르면 "바뀌었어요"로 묻는다. 단, 같은 값을 이미 넣었거나 거절했다면
 * (handled에 같은 signature) 사용자가 직접 고친 것이므로 다시 묻지 않는다.
 */
export function bookingSuggestions(trip: TripWorkspace, pages: readonly PageEntry[], handled: Handled, lang: Lang, reservationId?: string): Suggestion[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const titles = new Set(pages.filter((p) => p.tripId === trip.id && p.kind === "plan").map((p) => `${p.date}|${normalize(p.title)}`));
  return plannedLines(trip, lang, reservationId).flatMap((line): Suggestion[] => {
    const signature = signatureOf(line);
    if (handled[line.id] === signature) return [];
    const existing = byId.get(line.id);
    if (existing) {
      // 다른 수첩이 같은 id를 쓰고 있으면(예약 id가 겹친 드문 경우) 건드리지 않는다.
      if (existing.tripId !== trip.id || existing.kind !== "plan") return [];
      if (existing.date === line.date && existing.time === line.time) return [];
      return [{ ...line, state: "changed", previous: { date: existing.date, ...(existing.time ? { time: existing.time } : {}) }, signature }];
    }
    if (titles.has(`${line.date}|${normalize(line.title)}`)) return [];
    return [{ ...line, state: "new", signature }];
  });
}

/**
 * 고른 제안을 속지에 반영한다. 새 줄은 끝에 붙이고, 바뀐 줄은 날짜·시각·길이만 고친다(제목·메모는 사용자 것).
 * 이미 같은 id가 있으면 새로 붙이지 않아 두 번 눌러도 한 줄만 생긴다.
 */
export function applySuggestions(pages: readonly PageEntry[], chosen: readonly Suggestion[], tripId: string): PageEntry[] {
  const byId = new Map(chosen.map((s) => [s.id, s]));
  const present = new Set(pages.map((p) => p.id));
  const updated = pages.map((p) => {
    const s = byId.get(p.id);
    if (!s || s.state !== "changed" || p.tripId !== tripId || p.kind !== "plan") return p;
    const { time: _time, minutes: _minutes, ...rest } = p;
    return { ...rest, date: s.date, ...(s.time ? { time: s.time } : {}), ...(s.time && (s.minutes ?? p.minutes) ? { minutes: s.minutes ?? p.minutes } : {}) };
  });
  const added = chosen
    .filter((s) => s.state === "new" && !present.has(s.id))
    .map((s): PageEntry => ({
      id: s.id,
      tripId,
      kind: "plan",
      title: s.title,
      date: s.date,
      body: s.body,
      address: s.address,
      done: false,
      ...(s.time ? { time: s.time } : {}),
      ...(s.time && s.minutes ? { minutes: s.minutes } : {}),
    }));
  return [...updated, ...added];
}

/** 넣었거나 거절한 제안을 기억한다. 지금 예약에서 나오지 않는 id는 지워 기기 설정이 늘어나지 않게 한다. */
export function rememberHandled(handled: Handled, seen: readonly Suggestion[], current: readonly PlannedLine[]): Handled {
  const live = new Set(current.map((line) => line.id));
  const next: Handled = {};
  for (const [id, signature] of Object.entries(handled)) if (live.has(id)) next[id] = signature;
  for (const s of seen) next[s.id] = s.signature;
  return next;
}

/** 기기 설정에서 읽은 값. 형식이 틀리면 빈 값으로 본다(다시 물을 뿐 데이터는 바뀌지 않는다). */
export function parseHandled(raw: string | null): Handled {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[0].startsWith(PREFIX)));
  } catch {
    return {};
  }
}
