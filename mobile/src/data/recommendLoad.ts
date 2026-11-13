import { PICKS, roundNear, type BrowseNear } from "../../../src/domain/places/browse";
import { browsePlaces, type BrowseUsage } from "./placeBrowse";
import { PlaceError, placeLanguage } from "./places";
import { parseTaste, type Candidate, type Taste } from "./recommend";
import { todayStore } from "./sqlite";
import type { Lang } from "../i18n/strings";

// 추천 후보를 받아 앱을 켜 둔 동안 기억한다. 검색 한도(무료 월 5회)를 아끼려고 같은 기준점은 다시 묻지 않는다.
// Google 장소 정보(평점·영업시간·좌표)는 오래 보관할 수 없어 기기 저장소가 아닌 메모리에만 둔다.

/** 같은 수첩·언어·기준점(약 100m 단위)이면 이 시간 동안 다시 묻지 않는다(밀리초). */
const KEEP_MS = 6 * 60 * 60_000;
const memory = new Map<string, { at: number; result: CandidateSet }>();
const running = new Map<string, Promise<CandidateSet>>();
let generation = 0;

export interface CandidateSet {
  places: Candidate[];
  /** 예전 서버라 위치·영업시간 없이 분류 검색 두 번으로 대신 받았는지 */
  legacy: boolean;
}

export function candidateKey(tripId: string, lang: Lang, near: BrowseNear): string {
  const p = roundNear(near);
  return `${tripId}|${placeLanguage(lang)}|${p.latitude},${p.longitude}`;
}

export function rememberedCandidates(key: string, now = Date.now()): CandidateSet | undefined {
  const hit = memory.get(key);
  if (hit && now - hit.at < KEEP_MS) return hit.result;
  if (hit) memory.delete(key);
  return undefined;
}

/**
 * 기준점 근처 추천 후보. 서버에 검색 1회(Google 근처 검색 2번, 사진 없음)를 쓴다.
 * 새 추천을 모르는 예전 서버면 음식점·볼거리 분류 검색 두 번(검색 2회)으로 대신한다. 이때는 위치·영업시간이 없다.
 * 같은 열쇠의 요청이 진행 중이면 그 결과를 함께 기다린다.
 */
export function loadCandidates(call: { baseUrl: string; credential: string; lang: Lang; destination: string; tripId: string; near: BrowseNear; fetchImpl?: typeof fetch; onUsage?: (usage: BrowseUsage | null) => void; now?: () => number }): Promise<CandidateSet> {
  const now = call.now ?? Date.now;
  const key = candidateKey(call.tripId, call.lang, call.near);
  const hit = rememberedCandidates(key, now());
  if (hit) return Promise.resolve(hit);
  const pending = running.get(key);
  if (pending) return pending;
  const requestGeneration = generation;
  const request = { baseUrl: call.baseUrl, credential: call.credential, lang: call.lang, destination: call.destination, near: call.near, fetchImpl: call.fetchImpl, onUsage: call.onUsage };
  const job = (async (): Promise<CandidateSet> => {
    try {
      return { places: await browsePlaces({ ...request, category: PICKS }), legacy: false };
    } catch (error) {
      if (!(error instanceof PlaceError) || error.key !== "pick.oldServer") throw error;
      // 서버는 한 사람의 검색이 끝나기 전 다음 검색을 막으므로 차례로 부른다.
      const food = await browsePlaces({ ...request, category: "food" });
      const sights = await browsePlaces({ ...request, category: "sights" });
      return { places: [...food.map((p) => ({ ...p, hint: "food" as const })), ...sights.map((p) => ({ ...p, hint: "sights" as const }))], legacy: true };
    }
  })().then(
    (result) => {
      if (running.get(key) === job) running.delete(key);
      // 빈 응답은 일시적인 제공자 상태일 수 있으므로 재시도를 막지 않는다.
      if (requestGeneration === generation && result.places.length) memory.set(key, { at: now(), result });
      return result;
    },
    (error: unknown) => {
      if (running.get(key) === job) running.delete(key);
      throw error;
    },
  );
  running.set(key, job);
  return job;
}

/** 시험에서만 쓴다. */
export function forgetCandidates() {
  generation += 1;
  memory.clear();
  running.clear();
}

// 수첩별 취향 답. 오늘 탭의 기기 전용 값과 같은 칸에 두어 로그아웃할 때 함께 지운다.
export const tasteStore = {
  async get(tripId: string): Promise<Taste | null> {
    return parseTaste(await todayStore.get(`taste:${tripId}`).catch(() => null));
  },
  async set(tripId: string, taste: Taste) {
    await todayStore.set(`taste:${tripId}`, JSON.stringify(taste));
  },
};

/** 사진을 새로 요청하거나 저장하지 않고, 유효한 세션 후보의 사진만 재사용한다. */
export function rememberedPlacePhoto(placeId: string, now = Date.now()) {
  for (const { at, result } of memory.values()) {
    if (now < at || now - at >= KEEP_MS) continue;
    const photo = result.places.find(p => p.placeId === placeId)?.photo;
    if (photo) return photo;
  }
  return undefined;
}
