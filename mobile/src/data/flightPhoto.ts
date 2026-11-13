import type { Reservation } from "../../../src/domain/reservations/types";
import { validateReservation } from "../../../src/domain/reservations/reservations";
import { fromLocal } from "../../../src/domain/time/zoned";
import { airportCandidates, airportTimeZone } from "./airportNames";
import { bookingTime, bookingTimeZone } from "./bookingPhotoText";
import { bookingDates } from "./stayPhoto";

export type FlightPhotoDraft = Pick<Reservation, "title" | "startDate" | "timeZone"> & {
  endDate: string; startTime: string; endTime: string; endTimeZone: string;
  departure: string; arrival: string; serviceNumber: string;
};
/** OCR 한 줄. 위치(0~1 비율, 왼쪽 위 원점)가 있으면 두 단 레이아웃을 단별로 나눠 읽는다. */
export type OcrLine = string | { text: string; x?: number; y?: number; height?: number };
export const emptyFlightDraft = (): FlightPhotoDraft => ({ title: "", startDate: "", endDate: "", startTime: "", endTime: "", timeZone: "", endTimeZone: "", departure: "", arrival: "", serviceNumber: "" });

// "출발터미널", "Departure Terminal"처럼 출발·도착으로 시작하는 다른 칸은 구간 정보로 읽지 않는다.
const NOT_FIELD = "(?!\\s*(?:terminal|gate|터미널|게이트|ターミナル|ゲート))";
const DEPART = new RegExp(`^(?:depart(?:ure|s)?(?:\\s+(?:date|time))?|from|출발(?:일시|일|시각|시간|지)?|出発(?:日時|日|時刻|地)?)(?!\\p{L})${NOT_FIELD}\\s*[:：]?`, "iu");
const ARRIVE = new RegExp(`^(?:arriv(?:al|es)(?:\\s+(?:date|time))?|to|도착(?:일시|일|시각|시간|지)?|到着(?:日時|日|時刻|地)?)(?!\\p{L})${NOT_FIELD}\\s*[:：]?`, "iu");
// 항공사 코드는 두 글자이며 적어도 한 글자는 영문이다. "Flight 12" 같은 구간 머리말을 편명으로 읽지 않게 한다.
const DESIGNATOR = "([A-Z]{2}|[A-Z]\\d|\\d[A-Z])";
const FLIGHT_WORD = "flight(?:\\s*(?:number|no\\.?|#))?|(?:비행|항공)?편명|항공편(?:\\s*번호)?|便名|フライト(?:番号)?";
const FLIGHT = new RegExp(`^(?:${FLIGHT_WORD})\\s*[:：]?\\s*${DESIGNATOR}\\s*(\\d{1,4})(?:\\b|$)`, "i");
const FLIGHT_LABEL = new RegExp(`^(?:${FLIGHT_WORD})\\s*[:：]?$`, "i");
const BARE_FLIGHT = new RegExp(`^${DESIGNATOR}\\s?(\\d{1,4})$`);
// 한 장에 여러 구간을 싣는 확인서의 구간 머리말. 같은 행에 여러 개가 있으면 두 단 레이아웃이다.
const LEG_HEADER = /^(?:구간|여정|segment|leg|flight|trip|区間|旅程|行程|フライト)\s*#?\s*\d{1,2}$|^(?:가는\s*편|오는\s*편|outbound|inbound|return|往路|復路)$/i;
const DURATION = /^(?:flying\s*time|flight\s*time|travel\s*time|duration|비행\s*시간|소요\s*시간|飛行時間|所要時間)\s*[:：]?\s*(.*)$/i;
const OTHER_FIELD = /^(?:boarding|duration|travel time|gate|seat)\b|^(?:탑승|소요시간|소요 시간|搭乗|所要時間)|^[\p{L}][\p{L} /()-]{0,40}\s*[:：]/iu;
const PRIVATE = /booking\s*(?:id|reference|number)|confirmation|passenger|guest|예약\s*번호|확인\s*번호|항공권\s*번호|ticket\s*(?:no|number)|승객|성명|予約番号|航空券番号|搭乗者|passport|여권|password|비밀번호|https?:|@/i;
// 날짜·시간대 약어가 공항 코드처럼 보여도 고르지 않는다.
const NOT_AIRPORT = /^(?:UTC|GMT|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|MON|TUE|WED|THU|FRI|SAT|SUN|KST|JST|CET|EST|EDT|PST|PDT|CST|BST|SGT|ICT)$/;
const ARROW = /\s*(?:→|->|⇒|➔|➝|✈)\s*/;
const unique = (values: string[]) => new Set(values).size === 1 ? values[0] : "";

type Line = { text: string; x?: number; y?: number; height?: number };
type Stop = { role?: "dep" | "arr"; index: number; body: string };

/** 사진 한 장의 모든 구간을 읽는다. 왕복 확인서처럼 한 장에 두 구간이 있으면 둘 다 돌려준다. */
export function parseFlightLegs(raw: OcrLine[]): FlightPhotoDraft[] {
  const lines = raw.slice(0, 300).map(item => typeof item === "string" ? { text: item } : item)
    .map(line => ({ ...line, text: line.text.normalize("NFKC").trim() }))
    .filter(line => line.text && !PRIVATE.test(line.text));
  const chunks: string[][] = [[]];
  for (const text of readingOrder(lines)) {
    if (LEG_HEADER.test(text)) chunks.push([]);
    else chunks[chunks.length - 1].push(text);
  }
  const legs = chunks.flatMap((chunk, i) => chunkLegs(chunk, i > 0));
  const seen = new Set<string>();
  return legs.filter(leg => {
    const key = JSON.stringify(leg);
    return !seen.has(key) && !!seen.add(key);
  });
}

/** 한 구간만 명확할 때 그 구간을 돌려준다. 여러 구간을 한 초안으로 합치지 않는다. */
export function parseFlightPhoto(raw: OcrLine[]): FlightPhotoDraft {
  const legs = parseFlightLegs(raw);
  return legs.length === 1 ? legs[0] : emptyFlightDraft();
}

// 두 단 레이아웃(구간 1 | 구간 2)은 OCR이 행 단위로 읽어 두 구간의 줄이 번갈아 섞인다.
// 같은 행에 놓인 구간 머리말을 단의 시작으로 보고, 그 아래 줄을 왼쪽에서 가장 가까운 단에 모은다.
function readingOrder(lines: Line[]): string[] {
  if (!lines.length || !lines.every(l => typeof l.x === "number" && typeof l.y === "number")) return byStride(lines.map(l => l.text));
  const tolerance = (l: Line) => Math.max((l.height ?? 0) / 2, 0.004);
  const rows: Line[][] = [];
  for (const header of lines.filter(l => LEG_HEADER.test(l.text))) {
    const row = rows.find(r => Math.abs(r[0].y! - header.y!) <= tolerance(r[0]));
    if (row) row.push(header); else rows.push([header]);
  }
  if (!rows.some(row => row.length > 1)) return lines.map(l => l.text);
  rows.forEach(row => row.sort((a, b) => a.x! - b.x!));
  rows.sort((a, b) => a[0].y! - b[0].y!);
  const top = (row: Line[]) => row[0].y! - tolerance(row[0]);
  const out = lines.filter(l => l.y! < top(rows[0])).map(l => l.text);
  rows.forEach((row, i) => {
    const bottom = rows[i + 1] ? top(rows[i + 1]) : Infinity;
    const region = lines.filter(l => l.y! >= top(row) && l.y! < bottom);
    // 단 안의 줄은 머리말보다 조금 왼쪽에서 시작할 수 있어 0.03(폭의 3%)만큼 여유를 둔다.
    const column = (l: Line) => row.reduce((found, header, j) => l.x! >= header.x! - 0.03 ? j : found, 0);
    row.forEach((_, j) => out.push(...region.filter(l => column(l) === j).map(l => l.text)));
  });
  return out;
}

// 위치가 없는 이전 빌드에서는 연달아 나온 구간 머리말 수만큼 단이 있다고 보고 줄을 번갈아 나눈다.
// 한쪽 단만 값이 있는 행이 있으면 어긋날 수 있어, 위치를 받을 수 있으면 readingOrder의 위치 경로를 쓴다.
function byStride(texts: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < texts.length;) {
    let k = 0;
    while (i + k < texts.length && LEG_HEADER.test(texts[i + k])) k++;
    if (k < 2) { out.push(texts[i]); i++; continue; }
    let end = i + k;
    while (end < texts.length && !LEG_HEADER.test(texts[end])) end++;
    const body = texts.slice(i + k, end);
    for (let c = 0; c < k; c++) out.push(texts[i + c], ...body.filter((_, j) => j % k === c));
    i = end;
  }
  return out;
}

function flightNumber(lines: string[], index: number, headed: boolean): string {
  const s = lines[index];
  const m = FLIGHT.exec(s)
    ?? (FLIGHT_LABEL.test(s) && /^[A-Z0-9]{2}\s*\d{1,4}$/i.test(lines[index + 1] ?? "") ? FLIGHT.exec(`Flight: ${lines[index + 1]}`) : null)
    ?? (headed ? BARE_FLIGHT.exec(s) : null);
  return m ? (m[1] + m[2]).toUpperCase() : "";
}

// 구간 머리말 하나 아래(또는 머리말 없는 전체)에서 구간을 읽는다.
// 출발·도착 표시가 있으면 그 칸만 쓰고, 없으면 "16:40 청주 (CJJ)"처럼 시각과 공항이 함께 있는 줄을 출발·도착 순서로 짝짓는다.
function chunkLegs(lines: string[], headed: boolean): FlightPhotoDraft[] {
  const isField = (s: string) => DEPART.test(s) || ARRIVE.test(s) || FLIGHT.test(s) || FLIGHT_LABEL.test(s) || OTHER_FIELD.test(s) || LEG_HEADER.test(s);
  const labeled: Stop[] = [];
  lines.forEach((s, index) => {
    const role = DEPART.test(s) && !ARRIVE.test(s) ? "dep" : ARRIVE.test(s) && !DEPART.test(s) ? "arr" : undefined;
    if (!role) return;
    const parts = [s.replace(role === "dep" ? DEPART : ARRIVE, "")];
    for (const next of lines.slice(index + 1, index + 5)) {
      if (isField(next)) break;
      parts.push(next);
    }
    labeled.push({ role, index, body: parts.join(" ") });
  });
  const stops = labeled.length ? labeled : lines.flatMap((s, index) => OTHER_FIELD.test(s) || flightNumber(lines, index, headed) ? []
    : s.split(ARROW).filter(part => bookingTime(part) && codeTokens(part).length + airportCandidates(part).length > 0).map(body => ({ index, body } as Stop)))
    .map((stop, i) => ({ ...stop, role: i % 2 ? "arr" as const : "dep" as const }));

  const pairs: { dep?: Stop; arr?: Stop }[] = [];
  for (const stop of stops) {
    const last = pairs[pairs.length - 1];
    if (stop.role === "arr" && last && !last.arr) last.arr = stop;
    else pairs.push(stop.role === "dep" ? { dep: stop } : { arr: stop });
  }
  if (!pairs.length) return [];

  const numbers = lines.map((_, i) => flightNumber(lines, i, headed)).filter(Boolean);
  const numberFor = (i: number) => pairs.length === 1 ? unique(numbers) : numbers.length === pairs.length ? numbers[i] : "";
  const dateLines = lines.map((s, i) => ({ i, date: !/[:：]/.test(s) && !bookingTime(s) ? unique(bookingDates(s)) : "" })).filter(d => d.date);
  const durations = lines.map(s => DURATION.exec(s)?.[1]).filter((v): v is string => v !== undefined).map(minutesOf).filter(n => !Number.isNaN(n));
  const duration = pairs.length === 1 && durations.length === 1 ? durations[0] : undefined;

  return pairs.map(({ dep, arr }, i) => {
    const prev = pairs[i - 1];
    const after = prev ? Math.max(prev.dep?.index ?? -1, prev.arr?.index ?? -1) : -1;
    // 출발 칸에 날짜가 없으면 바로 위의 날짜만 있는 줄(예: "2026/12/21, 월요일")을 쓴다.
    const startDate = dep ? unique(bookingDates(dep.body)) || (dateLines.filter(d => d.i > after && d.i < dep.index).pop()?.date ?? "") : "";
    const departure = dep ? airportIn(dep.body) : "", arrival = arr ? airportIn(arr.body) : "";
    const startTime = dep ? bookingTime(dep.body) : "", endTime = arr ? bookingTime(arr.body) : "";
    const timeZone = dep ? zoneOf(dep.body, departure) : "", endTimeZone = arr ? zoneOf(arr.body, arrival) : "";
    const explicitEnd = arr ? unique(bookingDates(arr.body)) : "";
    const nextDay = arr && startDate ? /\(?\+\s?([12])\)?(?:\s*(?:day|일|日))?(?![\d:])/i.exec(arr.body.replace(/[+-]\d{2}:\d{2}\b/g, "")) : null;
    const endDate = explicitEnd || (nextDay ? addDays(startDate, Number(nextDay[1]))
      : arrivalDate(startDate, startTime, timeZone, endTime, endTimeZone, duration));
    const serviceNumber = numberFor(i);
    return { title: [serviceNumber, departure && arrival ? `${departure} → ${arrival}` : ""].filter(Boolean).join(" · "), serviceNumber,
      departure, arrival, startDate, endDate, startTime, endTime, timeZone, endTimeZone };
  });
}

function codeTokens(text: string): string[] {
  const parens = Array.from(text.matchAll(/\(\s*([^()\s]{2,5})\s*(?:\)|$)/g), m => m[1].toUpperCase()).filter(t => /^[A-Z0-9|\]]+$/.test(t));
  const bare = Array.from(text.matchAll(/\b[A-Z]{3}\b/g), m => m[0]);
  return [...new Set([...parens, ...bare])].filter(t => !NOT_AIRPORT.test(t));
}

// 공항 코드를 고른다. 같은 칸에 도시·공항 이름이 있으면 그 이름의 후보 중 OCR 코드와 가장 가까운 것으로 고친다.
// 예: "오사카 (KIDX)" → 후보 KIX·ITM 중 한 글자 차이인 KIX. 온전한 세 글자 코드가 이름과 두 글자 이상 다르면 문서의 코드를 믿는다.
function airportIn(text: string): string {
  const tokens = codeTokens(text);
  const clean = tokens.filter(t => /^[A-Z]{3}$/.test(t));
  const named = airportCandidates(text);
  if (!named.length) return unique(clean);
  const exact = clean.filter(code => named.includes(code));
  if (exact.length) return unique(exact);
  if (!tokens.length) return named.length === 1 ? named[0] : "";
  const scored = named.map(code => ({ code, d: Math.min(...tokens.map(t => editDistance(t, code))) }));
  const best = Math.min(...scored.map(s => s.d));
  const winners = scored.filter(s => s.d === best);
  if (winners.length === 1 && best <= (clean.length ? 1 : 2)) return winners[0].code;
  return unique(clean);
}

// 문서에 IANA 시간대가 적혀 있으면 그 값을, 없으면 알려진 공항의 시간대를 쓴다. 둘이 다르면 비워 사용자가 고르게 한다.
function zoneOf(body: string, airport: string): string {
  const written = bookingTimeZone(body), known = airport ? airportTimeZone(airport) : "";
  return written && known && written !== known ? "" : written || known;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

// "01:50", "1h 50m", "1시간 50분", "1時間50分"을 분으로 바꾼다. 읽지 못하면 NaN이라 비행시간 대조에서 빠진다.
function minutesOf(text: string): number {
  const m = /^(\d{1,2})\s*(?::|h|hr|시간|時間)\s*(\d{1,2})?/i.exec(text.trim());
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : NaN;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// 도착 날짜가 따로 없으면 양쪽 현지 시간대로 비행시간을 계산해 0~20시간이 되는 날 하나를 고른다.
// 문서에 비행시간이 있으면 그 값과 10분 안으로 맞는 날만 쓴다. 날짜변경선을 넘는 경우를 위해 전날도 본다.
// 예: CJJ 12/21 16:40(Asia/Seoul) → KIX 18:30(Asia/Tokyo)은 같은 날이면 110분이고 "Flying Time 01:50"과 맞아 12/21.
function arrivalDate(startDate: string, startTime: string, zone: string, endTime: string, endZone: string, minutes?: number): string {
  if (!startDate || !startTime || !endTime || !zone || !endZone) return "";
  try {
    const start = Date.parse(fromLocal(startDate, startTime, zone));
    const hits = [-1, 0, 1, 2].map(n => addDays(startDate, n)).filter(date => {
      try {
        const flown = (Date.parse(fromLocal(date, endTime, endZone)) - start) / 60_000;
        return minutes === undefined ? flown > 0 && flown <= 20 * 60 : Math.abs(flown - minutes) <= 10;
      } catch { return false; }
    });
    return hits.length === 1 ? hits[0] : "";
  } catch { return ""; }
}

/** 표시 이름을 바꿨어도 날짜·편명·구간이 같으면 다시 넣지 않는다. */
export function duplicateFlight(draft: FlightPhotoDraft, existing: Reservation[]): boolean {
  const normalized = (s?: string) => s?.normalize("NFKC").replace(/\s/g, "").toUpperCase() ?? "";
  const airport = (s?: string) => {
    const codes = (s?.normalize("NFKC").toUpperCase().match(/\b[A-Z]{3}\b/g) ?? []);
    return unique(codes) || normalized(s);
  };
  if (!draft.serviceNumber.trim() || !draft.startDate || !draft.departure.trim() || !draft.arrival.trim()) return false;
  return existing.some(r => r.kind === "flight" && r.startDate === draft.startDate
    && normalized(r.serviceNumber) === normalized(draft.serviceNumber)
    && airport(r.departure) === airport(draft.departure) && airport(r.arrival) === airport(draft.arrival));
}

/** 사진에서 온 초안은 필요한 날짜·구간·시간대를 직접 확인한 뒤에만 저장한다. */
export function confirmedFlight(draft: FlightPhotoDraft, id: string, now: string): Reservation | undefined {
  const d = Object.fromEntries(Object.entries(draft).map(([k,v]) => [k,v.trim()])) as FlightPhotoDraft;
  if (!d.endDate || !d.departure || !d.arrival || !d.serviceNumber || !d.endTimeZone) return undefined;
  const r: Reservation = { id, kind: "flight", title: d.title, startDate: d.startDate, endDate: d.endDate,
    timeZone: d.timeZone, endTimeZone: d.endTimeZone, departure: d.departure, arrival: d.arrival,
    serviceNumber: d.serviceNumber, startTime: d.startTime || undefined, endTime: d.endTime || undefined, updatedAt: now };
  return validateReservation(r).length ? undefined : r;
}
