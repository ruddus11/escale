import type { TripSettings } from "../../../src/domain/workspace/types";
import { type DayPlan } from "./dayPlan";
import { translate,type Key,type Lang } from "../i18n/strings";

// 오늘 탭 첫 장: 수첩이 먼저 채워 두고 사용자는 고르거나 지우기만 한다.
// 설계: docs/superpowers/specs/2026-10-16-today-first-page-design.md

// 모든 여행에 넣는 기본 목록(준비물과 출국 전 할 일).
const COMMON: Key[] = ["starter.passport", "starter.tickets", "starter.charger", "starter.battery", "starter.medicine", "starter.money", "starter.toiletries", "starter.clothes", "starter.umbrella", "starter.insurance", "starter.esim", "starter.stayAddress"];
// 일본 여행에 더하는 것. 앱 언어가 일본어면 일본 안 여행일 가능성이 높아 넣지 않는다.
const JAPAN: Key[] = ["starter.adapter", "starter.vjw", "starter.yen", "starter.icCard"];

const normal = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();

/** 수첩 시간대나 현지 통화로 일본 여행인지 본다. */
export function isJapanTrip(settings: Pick<TripSettings, "timeZone" | "localCurrency">): boolean {
  return settings.timeZone === "Asia/Tokyo" || settings.localCurrency === "JPY";
}

/** 한 번에 넣을 기본 목록. 이미 같은 이름(앞뒤 공백·대소문자 무시)이 있으면 뺀다. */
export function starterTitles(settings: Pick<TripSettings, "timeZone" | "localCurrency">, lang: Lang, existing: readonly { title: string }[]): string[] {
  const keys = isJapanTrip(settings) && lang !== "ja" ? [...COMMON, ...JAPAN] : COMMON;
  const have = new Set(existing.map((item) => normal(item.title)));
  return keys.map((key) => translate(lang, key)).filter((title) => !have.has(normal(title)));
}

export interface FirstPageSteps {
  packing: boolean;
  places: boolean;
}

/** 첫 장에 남길 줄. 끝난 줄은 빼고, 방금 넣은 챙길 것은 되돌릴 수 있게 그 줄만 남긴다. */
export function pendingFirstSteps(steps: FirstPageSteps, canUndo: boolean): (keyof FirstPageSteps)[] {
  return [...(!steps.packing || canUndo ? (["packing"] as const) : []), ...(!steps.places ? (["places"] as const) : [])];
}

export interface FreeSlot {
  start: number;
  end: number;
  category: "food" | "cafe";
}

// 식사 시간대(자정부터의 분): 11:00–14:00, 17:00–21:00. 빈 시간이 이와 겹치면 음식점을 권한다.
const MEALS: readonly (readonly [number, number])[] = [[11 * 60, 14 * 60], [17 * 60, 21 * 60]];

/** 오늘 일정 사이 1시간 이상 빈 시간 중 아직 끝나지 않은 것. dayPlan의 gap 연결(60분 이상)을 그대로 쓴다. */
export function freeTimeSlots(plan: DayPlan, nowMinutes: number): FreeSlot[] {
  return plan.links.flatMap((link, i): FreeSlot[] => {
    const start = plan.timed[i]?.end;
    const end = plan.timed[i + 1]?.start;
    if (link?.kind !== "gap" || start === undefined || end === undefined || end <= nowMinutes) return [];
    return [{ start, end, category: MEALS.some(([from, to]) => start < to && end > from) ? "food" : "cafe" }];
  });
}

export type HeroSource = { kind: "photo"; name: string } | { kind: "cover" };

/** 첫 장 사진: 고른 사진 파일이 이 기기에 남아 있으면 사진, 아니면 가로 속표지. 앱을 업데이트하면 문서 폴더의 절대 경로가 바뀌어 파일 이름만 저장한다. */
export function heroSource(saved: string | null, exists: (name: string) => boolean): HeroSource {
  return saved && exists(saved) ? { kind: "photo", name: saved } : { kind: "cover" };
}

/** 새 사진 파일 이름. 시각을 붙여 이전 사진과 겹치지 않게 한다. */
export const heroFileName = (tripId: string, now: Date) => `${tripId}-${now.getTime()}.jpg`;
