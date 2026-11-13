import type { ReservationKind } from "./types";

/**
 * 예약 확인 메일·문자를 붙여넣어 예약 칸을 채우기 위한 준비 단계.
 * 값은 코드가 원문에서 후보로만 뽑고, 어느 후보가 출발/도착인지는 판단 모델이 고른다.
 * 원문에 없는 값은 만들지 않는다.
 */

export interface Candidate {
  id: string;
  value: string;
  /** 판단에 쓰도록 후보 주변 원문 */
  snippet: string;
}

export interface ConfirmationCandidates {
  dates: Candidate[];
  times: Candidate[];
  places: Candidate[];
  services: Candidate[];
}

export interface ExtractedReservation {
  kind?: ReservationKind;
  title?: string;
  startDate?: string;
  startTime?: string;
  timeZone?: string;
  endDate?: string;
  endTime?: string;
  endTimeZone?: string;
  departure?: string;
  arrival?: string;
  serviceNumber?: string;
}

export const MAX_CONFIRMATION_LENGTH = 6000;
const MAX_CANDIDATES = 24;

/** 한국인이 자주 이용하는 공항. 코드로 도시 이름과 현지 시간대를 채운다. */
export const airports: Record<string, { city: string; timeZone: string }> = {
  ICN: { city: "인천", timeZone: "Asia/Seoul" }, GMP: { city: "김포", timeZone: "Asia/Seoul" },
  PUS: { city: "부산", timeZone: "Asia/Seoul" }, CJU: { city: "제주", timeZone: "Asia/Seoul" },
  TAE: { city: "대구", timeZone: "Asia/Seoul" }, CJJ: { city: "청주", timeZone: "Asia/Seoul" },
  NRT: { city: "도쿄 나리타", timeZone: "Asia/Tokyo" }, HND: { city: "도쿄 하네다", timeZone: "Asia/Tokyo" },
  KIX: { city: "오사카 간사이", timeZone: "Asia/Tokyo" }, ITM: { city: "오사카 이타미", timeZone: "Asia/Tokyo" },
  NGO: { city: "나고야", timeZone: "Asia/Tokyo" }, FUK: { city: "후쿠오카", timeZone: "Asia/Tokyo" },
  CTS: { city: "삿포로", timeZone: "Asia/Tokyo" }, OKA: { city: "오키나와", timeZone: "Asia/Tokyo" },
  KMJ: { city: "구마모토", timeZone: "Asia/Tokyo" }, KOJ: { city: "가고시마", timeZone: "Asia/Tokyo" },
  PEK: { city: "베이징", timeZone: "Asia/Shanghai" }, PKX: { city: "베이징 다싱", timeZone: "Asia/Shanghai" },
  PVG: { city: "상하이 푸둥", timeZone: "Asia/Shanghai" }, SHA: { city: "상하이 훙차오", timeZone: "Asia/Shanghai" },
  TPE: { city: "타이베이 타오위안", timeZone: "Asia/Taipei" }, TSA: { city: "타이베이 쑹산", timeZone: "Asia/Taipei" },
  HKG: { city: "홍콩", timeZone: "Asia/Hong_Kong" }, MFM: { city: "마카오", timeZone: "Asia/Macau" },
  SIN: { city: "싱가포르", timeZone: "Asia/Singapore" }, BKK: { city: "방콕", timeZone: "Asia/Bangkok" },
  HKT: { city: "푸껫", timeZone: "Asia/Bangkok" }, CNX: { city: "치앙마이", timeZone: "Asia/Bangkok" },
  DAD: { city: "다낭", timeZone: "Asia/Ho_Chi_Minh" }, SGN: { city: "호찌민", timeZone: "Asia/Ho_Chi_Minh" },
  HAN: { city: "하노이", timeZone: "Asia/Ho_Chi_Minh" }, CXR: { city: "나트랑", timeZone: "Asia/Ho_Chi_Minh" },
  PQC: { city: "푸꾸옥", timeZone: "Asia/Ho_Chi_Minh" }, MNL: { city: "마닐라", timeZone: "Asia/Manila" },
  CEB: { city: "세부", timeZone: "Asia/Manila" }, DPS: { city: "발리", timeZone: "Asia/Makassar" },
  KUL: { city: "쿠알라룸푸르", timeZone: "Asia/Kuala_Lumpur" }, BKI: { city: "코타키나발루", timeZone: "Asia/Kuching" },
  GUM: { city: "괌", timeZone: "Pacific/Guam" }, SPN: { city: "사이판", timeZone: "Pacific/Saipan" },
  DXB: { city: "두바이", timeZone: "Asia/Dubai" }, IST: { city: "이스탄불", timeZone: "Europe/Istanbul" },
  LHR: { city: "런던 히스로", timeZone: "Europe/London" }, CDG: { city: "파리 샤를드골", timeZone: "Europe/Paris" },
  FRA: { city: "프랑크푸르트", timeZone: "Europe/Berlin" }, MUC: { city: "뮌헨", timeZone: "Europe/Berlin" },
  FCO: { city: "로마", timeZone: "Europe/Rome" }, MXP: { city: "밀라노", timeZone: "Europe/Rome" },
  BCN: { city: "바르셀로나", timeZone: "Europe/Madrid" }, MAD: { city: "마드리드", timeZone: "Europe/Madrid" },
  AMS: { city: "암스테르담", timeZone: "Europe/Amsterdam" }, ZRH: { city: "취리히", timeZone: "Europe/Zurich" },
  PRG: { city: "프라하", timeZone: "Europe/Prague" }, VIE: { city: "빈", timeZone: "Europe/Vienna" },
  LAX: { city: "로스앤젤레스", timeZone: "America/Los_Angeles" }, SFO: { city: "샌프란시스코", timeZone: "America/Los_Angeles" },
  SEA: { city: "시애틀", timeZone: "America/Los_Angeles" }, LAS: { city: "라스베이거스", timeZone: "America/Los_Angeles" },
  JFK: { city: "뉴욕 JFK", timeZone: "America/New_York" }, EWR: { city: "뉴어크", timeZone: "America/New_York" },
  ATL: { city: "애틀랜타", timeZone: "America/New_York" }, ORD: { city: "시카고", timeZone: "America/Chicago" },
  DFW: { city: "댈러스", timeZone: "America/Chicago" }, YVR: { city: "밴쿠버", timeZone: "America/Vancouver" },
  YYZ: { city: "토론토", timeZone: "America/Toronto" }, HNL: { city: "호놀룰루", timeZone: "Pacific/Honolulu" },
  SYD: { city: "시드니", timeZone: "Australia/Sydney" }, MEL: { city: "멜버른", timeZone: "Australia/Melbourne" },
  BNE: { city: "브리즈번", timeZone: "Australia/Brisbane" }, AKL: { city: "오클랜드", timeZone: "Pacific/Auckland" },
};

const LABELED_SECRET =
  /((?:예약\s*번호|예약\s*코드|확인\s*번호|승인\s*번호|발권\s*번호|티켓\s*번호|탑승권\s*번호|회원\s*번호|여권\s*번호|booking\s*(?:ref(?:erence)?|code|no\.?|number)|confirmation\s*(?:code|no\.?|number)|reservation\s*(?:code|no\.?|number)|ticket\s*(?:no\.?|number)|e-?ticket|pnr|record\s*locator)\s*[:：#]?\s*)([A-Za-z0-9-]{4,20})/gi;

/** 서버로 보내기 전에 예약번호·연락처·결제번호처럼 보이는 부분을 가린다. */
export function redactConfirmation(text: string): string {
  return text
    .slice(0, MAX_CONFIRMATION_LENGTH)
    .replace(LABELED_SECRET, (_, label: string) => `${label}[가림]`)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[이메일]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[번호]")
    .replace(/(?:\+?\d{1,3}[ -]?)?\(?0?\d{1,4}\)?[ -]?\d{3,4}[ -]?\d{4}\b/g, "[전화]");
}

const monthNames: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
};

function isoDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function snippetAt(text: string, index: number, length: number) {
  return text.slice(Math.max(0, index - 40), Math.min(text.length, index + length + 40)).replace(/\s+/g, " ").trim();
}

/** 원문에서 날짜·시각·장소·편명 후보를 뽑는다. 연도가 없는 날짜는 referenceYear를 쓴다. */
export function findCandidates(text: string, referenceYear: number): ConfirmationCandidates {
  const found = { dates: [] as Candidate[], times: [] as Candidate[], places: [] as Candidate[], services: [] as Candidate[] };
  const seen = new Set<string>();
  const add = (list: Candidate[], prefix: string, value: string | undefined, index: number, length: number) => {
    if (!value || list.length >= MAX_CANDIDATES) return;
    // 같은 값이라도 다른 위치(가는 편/오는 편)는 따로 남긴다.
    const key = `${prefix}:${value}:${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ id: `${prefix}${list.length + 1}`, value, snippet: snippetAt(text, index, length) });
  };
  const each = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    for (const m of text.matchAll(re)) fn(m as RegExpExecArray);
  };

  each(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?/g, (m) =>
    add(found.dates, "d", isoDate(+m[1], +m[2], +m[3]), m.index!, m[0].length));
  each(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, (m) => {
    // "2026년 10월 12일"의 뒷부분은 위에서 이미 연도와 함께 잡았다.
    if (/[\d년.\-/]\s*$/.test(text.slice(Math.max(0, m.index! - 3), m.index!))) return;
    add(found.dates, "d", isoDate(referenceYear, +m[1], +m[2]), m.index!, m[0].length);
  });
  each(/\b(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG|SEPT?|OCT|NOV|DEC)[A-Z]*\.?,?\s*(\d{4}|\d{2})?\b/gi, (m) => {
    const month = monthNames[m[2].toUpperCase().slice(0, m[2].toUpperCase().startsWith("SEPT") ? 4 : 3)];
    const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : referenceYear;
    add(found.dates, "d", isoDate(year, month, +m[1]), m.index!, m[0].length);
  });
  each(/\b(JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG|SEPT?|OCT|NOV|DEC)[A-Z]*\.?\s+(\d{1,2}),?\s*(\d{4})?\b/gi, (m) => {
    const month = monthNames[m[1].toUpperCase().slice(0, m[1].toUpperCase().startsWith("SEPT") ? 4 : 3)];
    add(found.dates, "d", isoDate(m[3] ? +m[3] : referenceYear, month, +m[2]), m.index!, m[0].length);
  });

  each(/(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{2})\s*분?\s*(AM|PM|am|pm)?/g, (m) => {
    let h = +m[2];
    const pm = m[1] === "오후" || /pm/i.test(m[4] ?? ""), am = m[1] === "오전" || /am/i.test(m[4] ?? "");
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    if (h > 23 || +m[3] > 59) return;
    add(found.times, "t", `${String(h).padStart(2, "0")}:${m[3]}`, m.index!, m[0].length);
  });

  each(/\b([A-Z]{3})\b/g, (m) => {
    if (airports[m[1]]) add(found.places, "p", m[1], m.index!, m[0].length);
  });
  each(/([가-힣A-Za-z]{1,10}역)(?![가-힣])/g, (m) => add(found.places, "p", m[1], m.index!, m[0].length));

  each(/\b((?:KTX|SRT|ITX)[- ]?\d{1,4}|[A-Z][A-Z0-9]\s?\d{2,4})\b/g, (m) => {
    // 공항 코드나 날짜(12OCT) 조각을 편명으로 잘못 보지 않는다.
    if (/^\d/.test(m[1]) || airports[m[1].slice(0, 3)]) return;
    add(found.services, "s", m[1].replace(/\s+/, " "), m.index!, m[0].length);
  });
  return found;
}

/** 공항 코드는 "도시 코드"(예: "청주 CJJ")로 적고, 역 이름처럼 공항이 아닌 곳은 받은 그대로 둔다. */
function placeName(code?: string) {
  return code && airports[code] ? `${airports[code].city} ${code}` : code;
}

/**
 * 예약 읽기가 붙이는 제목. 편명 뒤에 도시 이름만 이은 경로를 쓴다(예: "RF392 청주 → 도쿄 나리타").
 * 계획 탭이 저장된 예약으로 이 제목을 다시 만들어 겹쳐 보이지 않게 하므로, 저장되는 칸만으로 만든다.
 */
export function autoTitle(r: Pick<ExtractedReservation, "serviceNumber" | "departure" | "arrival">): string | undefined {
  // placeName을 되돌린다. "청주 CJJ" → "청주", "서울역" → "서울역".
  const city = (place: string) => {
    const code = place.slice(-3);
    return airports[code] && place === placeName(code) ? airports[code].city : place;
  };
  const route = [r.departure && city(r.departure), r.arrival && city(r.arrival)].filter(Boolean).join(" → ");
  return [r.serviceNumber, route].filter(Boolean).join(" ").slice(0, 120) || undefined;
}

/** 판단 모델이 고른 후보를 예약 칸으로 옮긴다. 공항 코드면 도시와 시간대도 채운다. */
export function assembleReservation(
  candidates: ConfirmationCandidates,
  picked: { kind?: ReservationKind; startDate?: string; startTime?: string; endDate?: string; endTime?: string; departure?: string; arrival?: string; service?: string },
): ExtractedReservation {
  const value = (list: Candidate[], id?: string) => list.find((c) => c.id === id)?.value;
  const dep = value(candidates.places, picked.departure);
  const arr = value(candidates.places, picked.arrival);
  const startDate = value(candidates.dates, picked.startDate);
  const endDate = value(candidates.dates, picked.endDate);
  const startTime = value(candidates.times, picked.startTime);
  const endTime = value(candidates.times, picked.endTime);
  const serviceNumber = value(candidates.services, picked.service);
  const kind = picked.kind ?? (dep && airports[dep] ? "flight" : undefined);
  const out: ExtractedReservation = {
    kind,
    startDate,
    startTime: startDate ? startTime : undefined,
    endDate: endDate && startDate && endDate >= startDate ? endDate : undefined,
    departure: placeName(dep),
    arrival: placeName(arr),
    serviceNumber,
    timeZone: dep ? airports[dep]?.timeZone : undefined,
    endTimeZone: arr ? airports[arr]?.timeZone : undefined,
  };
  out.endTime = out.endDate ? endTime : undefined;
  if (!out.endDate && endTime && startDate) {
    // 도착 날짜가 따로 없으면 같은 날 도착으로 본다. 시간대가 달라도 앱 검증이 순서를 다시 확인한다.
    out.endDate = startDate;
    out.endTime = endTime;
  }
  out.title = autoTitle(out);
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as ExtractedReservation;
}
