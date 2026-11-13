import { WEEK_MINUTES, type BrowseNear, type BrowsePlace, type WeeklyHours } from "../../../src/domain/places/browse";
import type { Reservation } from "../../../src/domain/reservations/types";
import type { PageEntry } from "./model";
import { clock, toMinutes } from "./timeOfDay";
import { translate, type Key, type Lang } from "../i18n/strings";

// 추천 탭의 점수 계산. 화면·네트워크 없이 같은 입력이면 같은 결과를 낸다.
// 한 장소의 점수는 다섯 가지 이유의 가중 합이다(각 0~1).
//   시간대 30% · 거리 25% · 취향 20% · 평판 20% · 예산 5%, 그 시간에 연다는 것이 확실하면 +5%.
// 그 시간에 닫혀 있다고 확실한 곳은 점수를 매기지 않고 뺀다. 영업시간을 모르면 더하거나 빼지 않는다.
// 하루 안에서 같은 갈래(음식·카페…)를 이미 골랐으면 한 번 고를 때마다 점수에 0.75를 곱해 한 갈래로 몰리지 않게 한다.

export type Slot = "morning" | "lunch" | "afternoon" | "dinner" | "night";
export const SLOTS: Slot[] = ["morning", "lunch", "afternoon", "dinner", "night"];

/** 시간대의 시작 시각과 머무는 시간(자정부터의 분). 예: 점심 12:30부터 60분 → { start: 750, minutes: 60 }. */
export const slotTime: Record<Slot, { start: number; minutes: number }> = {
  morning: { start: 600, minutes: 90 },
  lunch: { start: 750, minutes: 60 },
  afternoon: { start: 900, minutes: 120 },
  dinner: { start: 1110, minutes: 90 },
  night: { start: 1260, minutes: 90 },
};

export type Kind = "food" | "cafe" | "nightlife" | "shopping" | "sights" | "culture" | "nature";
export type Interest = "food" | "shopping" | "sights" | "culture" | "nature" | "nightlife";
export const INTERESTS: Interest[] = ["food", "shopping", "sights", "culture", "nature", "nightlife"];
export type Pace = "relaxed" | "normal" | "packed";
export const PACES: Pace[] = ["relaxed", "normal", "packed"];
export type Budget = "save" | "mid" | "splurge";
export const BUDGETS: Budget[] = ["save", "mid", "splurge"];

/** 수첩마다 한 번 묻는 취향. */
export interface Taste {
  pace: Pace;
  interests: Interest[];
  budget: Budget;
}

export function parseTaste(raw: string | null): Taste | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Taste;
    if (!PACES.includes(v?.pace) || !BUDGETS.includes(v?.budget) || !Array.isArray(v?.interests)) return null;
    return { pace: v.pace, budget: v.budget, interests: INTERESTS.filter((i) => v.interests.includes(i)) };
  } catch {
    return null;
  }
}

/** 추천 후보. hint는 대표 유형을 모를 때(예전 서버의 분류 검색) 요청한 분류로 갈래를 정한다. */
export type Candidate = BrowsePlace & { hint?: Kind };

// Google 대표 유형 → 갈래. 목록에 없으면 이름 끝말과 hint로 정한다.
const KIND_OF: Record<string, Kind> = {
  cafe: "cafe", coffee_shop: "cafe", bakery: "cafe", dessert_shop: "cafe", tea_house: "cafe", cat_cafe: "cafe", dog_cafe: "cafe", ice_cream_shop: "cafe", confectionery: "cafe",
  bar: "nightlife", pub: "nightlife", wine_bar: "nightlife", night_club: "nightlife", cocktail_bar: "nightlife", karaoke: "nightlife",
  shopping_mall: "shopping", department_store: "shopping", market: "shopping", gift_shop: "shopping", book_store: "shopping", clothing_store: "shopping",
  museum: "culture", art_gallery: "culture", historical_landmark: "culture", performing_arts_theater: "culture", cultural_center: "culture", church: "culture", hindu_temple: "culture", mosque: "culture", synagogue: "culture", place_of_worship: "culture", buddhist_temple: "culture", shinto_shrine: "culture",
  park: "nature", garden: "nature", botanical_garden: "nature", national_park: "nature", zoo: "nature", aquarium: "nature", beach: "nature", hiking_area: "nature",
  tourist_attraction: "sights", observation_deck: "sights", amusement_park: "sights", landmark: "sights",
};

// 숙소·역·공항은 "볼거리" 유형이 함께 붙어 와도 들를 곳으로 추천하지 않는다.
const NOT_A_STOP = /^(hotel|lodging|hostel|motel|inn|resort_hotel|extended_stay_hotel|guest_house|bed_and_breakfast|japanese_inn|budget_japanese_inn|campground|rv_park|airport|international_airport|train_station|subway_station|bus_station|transit_station|light_rail_station|parking)$/;
// 예전 서버의 분류 검색은 대표 유형을 주지 않아 화면용 유형 이름으로만 숙소를 알아본다(세 언어).
const STAY_LABEL = /^(호텔|숙박 시설|게스트하우스|료칸|Hotel|Lodging|Hostel|Inn|ホテル|宿泊施設|旅館|ゲストハウス)$/i;

export function isStop(place: Candidate): boolean {
  return !NOT_A_STOP.test(place.primaryType ?? "") && !STAY_LABEL.test(place.type.trim());
}

export function placeKind(place: Candidate): Kind {
  const type = place.primaryType ?? "";
  if (KIND_OF[type]) return KIND_OF[type];
  if (/_restaurant$|^restaurant$|^food_court$|^meal_/.test(type)) return "food";
  if (/_store$/.test(type)) return "shopping";
  return place.hint ?? "sights";
}

const interestOf: Record<Kind, Interest> = { food: "food", cafe: "food", nightlife: "nightlife", shopping: "shopping", sights: "sights", culture: "culture", nature: "nature" };

// 시간대마다 갈래가 얼마나 어울리는지(0~1). 0이면 그 시간대에는 추천하지 않는다.
const SLOT_FIT: Record<Slot, Record<Kind, number>> = {
  morning: { cafe: 1, nature: 1, culture: 0.9, sights: 0.8, shopping: 0.3, food: 0.2, nightlife: 0 },
  lunch: { food: 1, cafe: 0.6, shopping: 0.3, sights: 0.2, culture: 0.2, nature: 0.2, nightlife: 0 },
  afternoon: { sights: 1, culture: 1, shopping: 1, nature: 0.8, cafe: 0.7, food: 0.2, nightlife: 0.1 },
  dinner: { food: 1, nightlife: 0.4, sights: 0.3, shopping: 0.3, cafe: 0.1, culture: 0.1, nature: 0.1 },
  night: { nightlife: 1, food: 0.5, sights: 0.4, shopping: 0.2, cafe: 0.2, culture: 0.1, nature: 0 },
};

export const WEIGHTS = { slot: 0.3, distance: 0.25, taste: 0.2, quality: 0.2, budget: 0.05, open: 0.05 } as const;
/** 같은 갈래를 하루에 한 번 더 고를 때마다 곱하는 값. */
export const DIVERSITY = 0.75;
// 걷는 거리 계산: 길은 직선보다 약 1.3배 돌아가고, 걷는 속도는 분당 80m. 예: 직선 500m → 650m → 8분.
const DETOUR = 1.3;
const WALK_M_PER_MIN = 80;
// 거리 점수가 1/e(약 0.37)로 떨어지는 도보 시간(분). 여유로운 여행일수록 가까운 곳을 앞에 둔다.
const WALK_SCALE: Record<Pace, number> = { relaxed: 12, normal: 18, packed: 25 };
// 이보다 멀면 도보 시간 대신 km로 적는다(분).
const WALK_LABEL_MAX = 25;
// 예전 서버(위치 없는 분류 검색)의 후보는 모두 기준점 1.5km 안이라 중간 정도로 본다.
const UNKNOWN_DISTANCE_FIT = 0.6;
// 그 시간에 들어가 최소 이만큼은 머물 수 있어야 연다고 본다(분).
const MIN_STAY = 45;

export function distanceM(a: BrowseNear, b: BrowseNear): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * DETOUR) / WALK_M_PER_MIN));
}

/**
 * 그 날짜 그 시각(여행지 현지, 자정부터의 분)에 열어 MIN_STAY분 머물 수 있는지. 영업시간을 모르면 undefined.
 * 날짜는 여행지 날짜 그대로라 시간대 변환이 필요 없다. 요일만 날짜에서 읽는다.
 */
export function isOpenAt(hours: WeeklyHours[] | undefined, date: string, minute: number, stay = MIN_STAY): boolean | undefined {
  if (!hours?.length) return undefined;
  const t = new Date(`${date}T12:00:00Z`).getUTCDay() * 1440 + minute;
  // 시작과 끝만 검사하면 중간 휴게 시간에도 영업 중이라고 잘못 판단한다.
  return hours.some((h) => [-1, 0, 1].some((week) => {
    const open = h.open + week * WEEK_MINUTES;
    const close = h.close + (h.close <= h.open ? WEEK_MINUTES : 0) + week * WEEK_MINUTES;
    return open <= t && t + stay <= close;
  }));
}

/** 하루의 기준점. plan은 그날 일정들의 가운데, stay는 그날 밤 숙소, center는 여행지 중심. */
export type BaseKind = "stay" | "plan" | "center";
export interface DayBase {
  kind: BaseKind;
  point: BrowseNear;
  label: string;
}

/**
 * 그날 일정이 있는 곳 → 그날 밤 숙소 → 여행지 중심 순으로 기준점을 고른다.
 * 일정이 여럿이면 위도·경도의 중앙값을 써서 멀리 떨어진 한 곳(예: 공항)에 끌려가지 않게 한다.
 */
export function chooseBase(input: { plan: BrowseNear[]; stay?: { point: BrowseNear; title: string }; center?: BrowseNear; destination: string }): DayBase | null {
  if (input.plan.length) {
    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    return { kind: "plan", point: { latitude: median(input.plan.map((p) => p.latitude)), longitude: median(input.plan.map((p) => p.longitude)) }, label: "" };
  }
  if (input.stay) return { kind: "stay", point: input.stay.point, label: input.stay.title };
  if (input.center) return { kind: "center", point: input.center, label: input.destination };
  return null;
}

/** 카드에 한 줄로 적는 이유. 화면 언어로 바꾸는 일은 reasonLine이 한다. */
export interface Reason {
  from: BaseKind;
  walk?: number;
  km?: number;
  /** 위치를 몰라 "기준점 근처"로만 말할 수 있을 때 */
  near?: boolean;
  /** 이 시간대에 연다는 것이 영업시간으로 확인됐을 때 */
  open?: Slot;
  /** 열린다는 확인이 없을 때 대신 적는 취향 일치 */
  likes?: boolean;
}

export interface Pick {
  place: Candidate;
  kind: Kind;
  score: number;
  factors: { slot: number; distance: number; taste: number; quality: number; budget: number; open: boolean | undefined };
  reason: Reason;
}

/** 평점 × log(리뷰 수). 리뷰 1만 개(log10 = 4)면 최대. 예: 4.5점·리뷰 1,000개 → 0.9 × 0.75 = 0.68. 평점을 모르면 0.35. */
export function qualityPrior(rating: number | undefined, reviews: number | undefined): number {
  if (rating === undefined) return 0.35;
  return (rating / 5) * Math.min(1, Math.log10(1 + (reviews ?? 0)) / 4);
}

function budgetFit(budget: Budget, level: number | undefined): number {
  if (level === undefined) return 0.7;
  if (budget === "save") return [1, 1, 0.7, 0.3, 0.1][level] ?? 0.7;
  if (budget === "splurge") return [0.6, 0.6, 0.8, 1, 1][level] ?? 0.7;
  return [1, 1, 1, 0.7, 0.4][level] ?? 0.7;
}

function tasteFit(taste: Taste, kind: Kind, slot: Slot): number {
  const fit = !taste.interests.length ? 0.5 : taste.interests.includes(interestOf[kind]) ? 1 : 0.25;
  // 끼니 시간의 식당은 음식에 관심을 고르지 않았어도 꼭 필요하다.
  return (slot === "lunch" || slot === "dinner") && kind === "food" ? Math.max(fit, 0.75) : fit;
}

/** 한 시간대에서 한 장소의 점수. 그 시간에 닫혀 있거나 시간대에 맞지 않으면 null. */
export function scorePlace(place: Candidate, input: { slot: Slot; date: string; base: DayBase; taste: Taste; start?: number }): Pick | null {
  if (!isStop(place)) return null;
  const kind = placeKind(place);
  const slot = SLOT_FIT[input.slot][kind];
  if (!slot) return null;
  const open = isOpenAt(place.hours, input.date, input.start ?? slotTime[input.slot].start);
  if (open === false) return null;
  const meters = place.location ? distanceM(input.base.point, place.location) : undefined;
  const walk = meters === undefined ? undefined : walkMinutes(meters);
  const distance = walk === undefined ? UNKNOWN_DISTANCE_FIT : Math.exp(-walk / WALK_SCALE[input.taste.pace]);
  const taste = tasteFit(input.taste, kind, input.slot);
  const quality = qualityPrior(place.rating, place.reviews);
  const budget = budgetFit(input.taste.budget, place.priceLevel);
  const score = WEIGHTS.slot * slot + WEIGHTS.distance * distance + WEIGHTS.taste * taste + WEIGHTS.quality * quality + WEIGHTS.budget * budget + (open ? WEIGHTS.open : 0);
  const reason: Reason = { from: input.base.kind };
  if (walk === undefined) reason.near = true;
  else if (walk <= WALK_LABEL_MAX) reason.walk = walk;
  else reason.km = Math.round(meters! / 100) / 10;
  if (open) reason.open = input.slot;
  else if (taste === 1) reason.likes = true;
  return { place, kind, score, factors: { slot, distance, taste, quality, budget, open }, reason };
}

const normalize = (text: string) => text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

/** 이미 담았거나 계획에 넣은 장소. 장소 ID가 같거나 이름이 같으면 같은 곳으로 본다. */
export function knownPlaces(pages: PageEntry[]): { ids: Set<string>; names: Set<string> } {
  return {
    ids: new Set(pages.flatMap((p) => (p.placeId ? [p.placeId] : []))),
    names: new Set(pages.filter((p) => p.kind !== "journal").map((p) => normalize(p.title))),
  };
}

export function isKnown(place: Candidate, known: { ids: Set<string>; names: Set<string> }): boolean {
  return known.ids.has(place.placeId) || known.names.has(normalize(place.name));
}

/** 하루에 쓸 수 있는 시간(자정부터의 분). 비행기로 도착·출발하는 날만 줄어든다. */
export interface DayWindow {
  start: number;
  end: number;
  arrival?: number;
  departure?: number;
}

/** 내린 뒤 입국 심사·짐 찾기·시내 이동에 잡는 시간(분). 예약 자동 채움의 "도착" 줄 길이와 같다. 예: 14:10 도착 → 15:40부터. */
export const LANDING_BUFFER = 90;
/** 돌아가는 비행기 출발 이만큼 전에 그날 일정을 끝낸다(분). 예: 18:00 출발 → 15:00까지. */
export const DEPARTURE_BUFFER = 180;
/** 국내선은 출발 2시간 전까지로 줄인다(분). 예: 18:00 출발 → 16:00까지. */
export const DOMESTIC_DEPARTURE_BUFFER = 120;

/**
 * 출발 몇 분 전에 공항으로 떠나야 하는지. 출발·도착 시간대가 같은 IANA 이름이면 국내선(2시간), 그 밖은 국제선(3시간).
 * 도착 시간대를 모르면 국제선으로 본다. 예: Asia/Tokyo → Asia/Tokyo = 120, Asia/Tokyo → Asia/Seoul = 180.
 * 미국 국내선처럼 시간대가 다른 국내선은 국제선으로 보아 일찍 떠나게 한다.
 */
export function departureLead(flight: Reservation): number {
  return flight.endTimeZone && flight.endTimeZone === flight.timeZone ? DOMESTIC_DEPARTURE_BUFFER : DEPARTURE_BUFFER;
}

/**
 * 그날 여행지에서 쓸 수 있는 시간. 여행지 시간대로 적힌 항공편만 본다.
 * 같은 날 도착보다 이른 출발(집에서 떠나는 국내선 등)은 돌아가는 편이 아니므로 무시한다.
 */
export function dayWindow(reservations: Reservation[] | undefined, date: string, tripZone: string): DayWindow {
  let arrival: number | undefined;
  let departure: number | undefined;
  let lead = DEPARTURE_BUFFER;
  const flights = (reservations ?? []).filter((r) => r.kind === "flight");
  for (const r of flights) {
    const landDate = r.endDate ?? r.startDate;
    const land = toMinutes(r.endTime);
    if (landDate === date && land !== undefined && (r.endTimeZone || r.timeZone) === tripZone) arrival = Math.max(arrival ?? 0, land);
  }
  for (const r of flights) {
    const leave = toMinutes(r.startTime);
    if (r.startDate !== date || leave === undefined || r.timeZone !== tripZone) continue;
    if (arrival !== undefined && leave <= arrival) continue;
    if (departure === undefined || leave < departure) {
      departure = leave;
      lead = departureLead(r);
    }
  }
  return {
    start: arrival === undefined ? 0 : Math.min(1440, arrival + LANDING_BUFFER),
    end: departure === undefined ? 1440 : Math.max(0, departure - lead),
    ...(arrival !== undefined ? { arrival } : {}),
    ...(departure !== undefined ? { departure } : {}),
  };
}

/** 시간대를 그날 쓸 수 있는 시간에 맞춘다. 45분도 못 머물면 null. 시작은 10분 단위로 올린다. 예: 16:03 → 16:10. */
export function fitSlot(slot: Slot, window: DayWindow): { start: number; minutes: number } | null {
  const { start, minutes } = slotTime[slot];
  const from = Math.ceil(Math.max(start, window.start) / 10) * 10;
  const to = Math.min(start + minutes, window.end);
  return to - from >= MIN_STAY ? { start: from, minutes: to - from } : null;
}

export interface SlotPicks {
  slot: Slot;
  start: number;
  minutes: number;
  picks: Pick[];
}

/**
 * 하루 추천. 시간대마다 perSlot곳까지, 한 장소는 하루에 한 번만 나온다.
 * 시간대 순서대로 가장 높은 점수를 하나씩 고르고, 고를 때마다 같은 갈래의 남은 후보 점수를 DIVERSITY만큼 낮춘다.
 */
export function recommendDay(input: { candidates: Candidate[]; date: string; base: DayBase; taste: Taste; window: DayWindow; known: { ids: Set<string>; names: Set<string> }; perSlot?: number; slots?: Slot[] }): SlotPicks[] {
  const perSlot = input.perSlot ?? 3;
  const used = new Set<string>();
  const kindCount: Partial<Record<Kind, number>> = {};
  const fresh = input.candidates.filter((c) => !isKnown(c, input.known));
  const result: SlotPicks[] = [];
  for (const slot of input.slots ?? SLOTS) {
    const fit = fitSlot(slot, input.window);
    if (!fit) continue;
    const scored = fresh.flatMap((c) => {
      const pick = used.has(c.placeId) ? null : scorePlace(c, { slot, date: input.date, base: input.base, taste: input.taste, start: fit.start });
      return pick ? [pick] : [];
    });
    const picks: Pick[] = [];
    while (picks.length < perSlot && scored.length) {
      let best = 0;
      const adjusted = (p: Pick) => p.score * DIVERSITY ** (kindCount[p.kind] ?? 0);
      for (let i = 1; i < scored.length; i++) if (adjusted(scored[i]) > adjusted(scored[best])) best = i;
      const [chosen] = scored.splice(best, 1);
      picks.push({ ...chosen, score: adjusted(chosen) });
      used.add(chosen.place.placeId);
      kindCount[chosen.kind] = (kindCount[chosen.kind] ?? 0) + 1;
    }
    if (picks.length) result.push({ slot, ...fit, picks });
  }
  return result;
}

/** 담기: 그날 계획에 넣는다. 그 시간대가 비어 있으면 시각까지, 다른 계획과 겹치면 시각 없이 넣는다. */
export function pickToPage(pick: Pick, at: { start: number; minutes: number }, day: { tripId: string; id: string; date: string; pages: PageEntry[] }): PageEntry {
  const end = at.start + at.minutes;
  const busy = day.pages.some((p) => {
    if (p.kind !== "plan" || p.date !== day.date) return false;
    const start = toMinutes(p.time);
    return start !== undefined && start < end && at.start < start + (p.minutes ?? 60);
  });
  return {
    id: day.id,
    tripId: day.tripId,
    kind: "plan",
    title: pick.place.name.trim().slice(0, 120),
    date: day.date,
    body: "",
    address: pick.place.address.slice(0, 300),
    placeId: pick.place.placeId,
    done: false,
    ...(busy ? {} : { time: clock(at.start), minutes: at.minutes }),
  };
}

/** 카드의 이유 한 줄. 예: "숙소에서 도보 8분 · 저녁 시간에 열어요" */
export function reasonLine(reason: Reason, lang: Lang): string {
  const parts: string[] = [];
  if (reason.walk !== undefined) parts.push(translate(lang, `pick.walk.${reason.from}` as Key, { n: reason.walk }));
  else if (reason.km !== undefined) parts.push(translate(lang, `pick.km.${reason.from}` as Key, { km: reason.km }));
  else if (reason.near) parts.push(translate(lang, `pick.near.${reason.from}` as Key));
  if (reason.open) parts.push(translate(lang, `pick.open.${reason.open}` as Key));
  else if (reason.likes) parts.push(translate(lang, "pick.likes"));
  return parts.join(" · ");
}

/** Google 지도 대중교통 길찾기. 기준점에서 이 장소까지, 장소 ID로 정확한 곳을 가리킨다. */
export function directionsUrl(from: BrowseNear | null, place: Candidate): string {
  const query = new URLSearchParams({ api: "1", destination: `${place.name} ${place.address}`.trim(), destination_place_id: place.placeId, travelmode: "transit" });
  if (from) query.set("origin", `${from.latitude},${from.longitude}`);
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

// 일정 초안: 항공편만 있는 수첩에 날짜별 동네와 시간대를 채운다.

/** 하루에 넣는 시간대. 여유 3곳, 보통·빡빡 4곳. 빡빡하게 다니며 밤 문화를 고르면 아침 대신 밤을 넣는다. */
export function paceSlots(taste: Taste): Slot[] {
  if (taste.pace === "relaxed") return ["lunch", "afternoon", "dinner"];
  if (taste.pace === "packed" && taste.interests.includes("nightlife")) return ["lunch", "afternoon", "dinner", "night"];
  return ["morning", "lunch", "afternoon", "dinner"];
}

/** 도착한 날은 가볍게. 여유면 한 곳, 아니면 두 곳까지. */
const ARRIVAL_MAX: Record<Pace, number> = { relaxed: 1, normal: 2, packed: 2 };
// 하루의 동네: 그날 중심 장소에서 이 거리 안의 후보만 쓴다(미터). 시간대 수 + 2곳(바꿔 넣을 후보)보다 적으면 넓힌다.
const AREA_STEPS_M = [1000, 1600, Infinity];
// 다음 날 중심 장소는 앞서 고른 중심에서 이만큼 떨어진 곳을 먼저 찾는다(미터).
const AREA_GAP_M = 1200;

export interface DraftItem {
  key: string;
  slot: Slot;
  start: number;
  minutes: number;
  pick: Pick;
  /** "다른 곳"을 누르면 차례로 바꿔 넣을 후보 */
  alternatives: Pick[];
}
export interface DraftDay {
  date: string;
  /** 그날 동네의 중심 장소 이름. 도착일은 숙소 근처라 비운다. */
  area: string;
  window: DayWindow;
  items: DraftItem[];
}

/**
 * 항공편만 있는 수첩의 일정 초안. 계획이 이미 있는 날은 건드리지 않는다.
 * 하루에 동네 하나: 볼거리 중 점수가 높고 앞선 날의 중심과 1.2km 넘게 떨어진 곳을 그날 중심으로 삼고,
 * 그 주변 후보로 시간대를 채운다. 도착일은 숙소(기준점) 근처, 출발일은 출발 3시간(국내선 2시간) 전까지만 넣는다.
 */
export function buildDraft(input: { dates: string[]; busyDates: Set<string>; candidates: Candidate[]; base: DayBase; taste: Taste; reservations: Reservation[] | undefined; tripZone: string; known: { ids: Set<string>; names: Set<string> } }): DraftDay[] {
  // 위치를 모르는 후보(예전 서버)는 기준점 1.5km 안이라 어느 날의 동네에도 넣을 수 있다.
  const fresh = input.candidates.filter((c) => !isKnown(c, input.known) && isStop(c));
  const used = new Set<string>();
  const anchors: BrowseNear[] = [];
  const days: DraftDay[] = [];
  for (const date of input.dates) {
    if (input.busyDates.has(date)) continue;
    const window = dayWindow(input.reservations, date, input.tripZone);
    let slots = paceSlots(input.taste).filter((slot) => fitSlot(slot, window));
    if (window.arrival !== undefined) slots = slots.slice(-ARRIVAL_MAX[input.taste.pace]);
    if (!slots.length) continue;
    let center: DayBase = input.base;
    let area = "";
    if (window.arrival === undefined) {
      const anchor = pickAnchor(fresh.filter((c) => !used.has(c.placeId)), anchors, input.base, input.taste);
      if (anchor) {
        center = { kind: input.base.kind, point: anchor.location!, label: anchor.name };
        area = anchor.name;
        anchors.push(anchor.location!);
      }
    }
    const pool = (() => {
      const free = fresh.filter((c) => !used.has(c.placeId));
      for (const radius of AREA_STEPS_M) {
        const near = free.filter((c) => !c.location || distanceM(center.point, c.location) <= radius);
        if (near.length >= slots.length + 2 || radius === Infinity) return near;
      }
      return free;
    })();
    // 시간대마다 한 곳을 먼저 고르고, 바꿔 넣을 후보는 그날 고른 곳을 뺀 나머지에서 시간대별로 두 곳씩 둔다.
    // 점수의 거리는 그날 동네 중심에서 재고, 카드 이유의 거리는 숙소(기준점)에서 잰다.
    const plan = recommendDay({ candidates: pool, date, base: center, taste: input.taste, window, known: { ids: used, names: new Set() }, perSlot: 1, slots });
    const chosen = new Set(plan.map((s) => s.picks[0].place.placeId));
    const withReason = (p: Pick, slot: Slot, start: number) => ({ ...p, reason: scorePlace(p.place, { slot, date, base: input.base, taste: input.taste, start })?.reason ?? p.reason });
    const items: DraftItem[] = plan.map((s) => {
      const alternatives = pool
        .flatMap((c) => (chosen.has(c.placeId) ? [] : [scorePlace(c, { slot: s.slot, date, base: center, taste: input.taste, start: s.start })]))
        .filter((p): p is Pick => !!p)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);
      return { key: `${date}-${s.slot}`, slot: s.slot, start: s.start, minutes: s.minutes, pick: withReason(s.picks[0], s.slot, s.start), alternatives: alternatives.map((p) => withReason(p, s.slot, s.start)) };
    });
    for (const item of items) used.add(item.pick.place.placeId);
    if (items.length) days.push({ date, area, window, items });
  }
  return days;
}

function pickAnchor(pool: Candidate[], anchors: BrowseNear[], base: DayBase, taste: Taste): Candidate | undefined {
  const sights = pool.filter((c) => c.location && ["sights", "culture", "nature", "shopping"].includes(placeKind(c)));
  const rank = (c: Candidate) => WEIGHTS.taste * tasteFit(taste, placeKind(c), "afternoon") + WEIGHTS.quality * qualityPrior(c.rating, c.reviews) + WEIGHTS.distance * Math.exp(-walkMinutes(distanceM(base.point, c.location!)) / (WALK_SCALE[taste.pace] * 3));
  const sorted = [...sights].sort((a, b) => rank(b) - rank(a));
  return sorted.find((c) => anchors.every((a) => distanceM(a, c.location!) > AREA_GAP_M)) ?? sorted[0];
}

/**
 * 초안의 "다른 곳": 지금 장소를 후보 목록 뒤로 보내고 다음 후보를 넣는다.
 * taken은 초안의 다른 줄에 이미 들어간 장소 ID다. 같은 곳이 두 줄에 들어가지 않게 건너뛴다.
 */
export function swapDraftItem(item: DraftItem, taken: Set<string> = new Set()): DraftItem {
  const index = item.alternatives.findIndex((p) => !taken.has(p.place.placeId));
  if (index < 0) return item;
  const next = item.alternatives[index];
  return { ...item, pick: next, alternatives: [...item.alternatives.slice(index + 1), ...item.alternatives.slice(0, index), item.pick] };
}

/** 확인한 초안을 계획 속지로. 시각과 머무는 시간까지 넣는다. */
export function draftToPages(days: DraftDay[], tripId: string, newId: () => string): PageEntry[] {
  return days.flatMap((day) =>
    day.items.map((item) => ({
      id: newId(),
      tripId,
      kind: "plan" as const,
      title: item.pick.place.name.trim().slice(0, 120),
      date: day.date,
      body: "",
      address: item.pick.place.address.slice(0, 300),
      placeId: item.pick.place.placeId,
      done: false,
      time: clock(item.start),
      minutes: item.minutes,
    })),
  );
}

/** "일정 초안 짜기"를 보일지: 항공편이 있고, 계획이 있는 날이 여행 일수의 절반에 못 미칠 때. */
export function wantsDraft(reservations: Reservation[] | undefined, pages: PageEntry[], dates: string[]): boolean {
  if (!(reservations ?? []).some((r) => r.kind === "flight")) return false;
  const planned = new Set(pages.filter((p) => p.kind === "plan").map((p) => p.date));
  return dates.filter((d) => planned.has(d)).length < Math.ceil(dates.length / 2);
}
