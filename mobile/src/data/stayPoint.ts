import type { BrowseNear } from "../../../src/domain/places/browse";
import { cacheKey, findPlace, isFresh, type CachedPoint } from "./places";
import type { StayOption } from "./placeBrowse";
import { placeCacheStore } from "./sqlite";
import type { Lang } from "../i18n/strings";

/**
 * 둘러보기 기준이 되는 숙소 위치. 계획 지도와 같은 기기 캐시(30일)를 먼저 보고, 없으면 장소 찾기로 받아 둔다.
 * 좌표는 수첩(계정 백업)에 넣지 않는다. 숙소를 찾지 못하면 null.
 */
export async function stayPoint(call: { baseUrl: string; credential: string; lang: Lang }, stay: StayOption, now = new Date()): Promise<BrowseNear | null> {
  const key = cacheKey({ address: stay.query });
  if (!key) return null;
  const cached = (await placeCacheStore.get([key]).catch(() => ({}) as Record<string, CachedPoint>))[key];
  if (cached && isFresh(cached, now)) return { latitude: cached.latitude, longitude: cached.longitude };
  const point = await findPlace({ ...call, text: stay.query });
  if (!point) return null;
  await placeCacheStore
    .set(key, { latitude: point.latitude, longitude: point.longitude, placeId: point.placeId, at: now.toISOString() })
    .catch(() => undefined);
  return { latitude: point.latitude, longitude: point.longitude };
}
