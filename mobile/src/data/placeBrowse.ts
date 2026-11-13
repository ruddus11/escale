import { BROWSE_MAX_PLACES, PICKS, PICKS_MAX_PLACES, isGooglePhotoUri, isWeeklyHours, roundNear, type BrowseCategory, type BrowseNear, type BrowsePlace } from "../../../src/domain/places/browse";
import type { Reservation } from "../../../src/domain/reservations/types";
import { PlaceError, placeLanguage } from "./places";
import type { Lang } from "../i18n/strings";
import type { PageEntry } from "./model";
import { fetchWithTimeout, isFetchTimeout } from "./fetchWithTimeout";
export type { BrowseCategory, BrowseNear, BrowsePlace } from "../../../src/domain/places/browse";

/** 둘러보기 기준으로 고를 수 있는 숙소. query는 위치를 찾을 때 쓰는 주소(없으면 숙소 이름과 여행지). */
export interface StayOption {
  id: string;
  title: string;
  query: string;
}

/** 수첩의 숙소 예약 중 둘러보기 기준이 될 것. 오늘 묵는 숙소를 맨 앞에, 나머지는 날짜 순, 같은 곳은 한 번만, 세 곳까지. */
export function stayOptions(reservations: Reservation[] | undefined, destination: string, today: string): StayOption[] {
  const tonight = (r: Reservation) => r.startDate <= today && (r.endDate ? today < r.endDate : today === r.startDate);
  const seen = new Set<string>();
  return (reservations ?? [])
    .filter((r) => r.kind === "stay")
    .sort((a, b) => Number(tonight(b)) - Number(tonight(a)) || a.startDate.localeCompare(b.startDate))
    .flatMap((r) => {
      const query = (r.address?.trim() || `${r.title.trim()} ${destination.trim()}`.trim()).slice(0, 120);
      const key = query.toLowerCase();
      if (!query || seen.has(key)) return [];
      seen.add(key);
      return [{ id: r.id, title: r.title.trim(), query }];
    })
    .slice(0, 3);
}
export interface BrowseUsage {
  tier: "admin" | "free" | "paid";
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
}
function readUsage(raw: unknown): BrowseUsage | null {
  const v = raw as BrowseUsage | null;
  if (!v || typeof v.resetsAt !== "string" || !Number.isFinite(Date.parse(v.resetsAt))) return null;
  if (v.tier === "admin" && v.limit === null && v.remaining === null) return v;
  return (v.tier === "free" || v.tier === "paid") && Number.isSafeInteger(v.limit) && Number(v.limit) > 0 && Number.isSafeInteger(v.remaining) && Number(v.remaining) >= 0 && Number(v.remaining) < Number(v.limit) ? v : null;
}

export async function browsePlaces(call: { baseUrl: string; credential: string; lang: Lang; destination: string; category: BrowseCategory | typeof PICKS; near?: BrowseNear; signal?: AbortSignal; fetchImpl?: typeof fetch; onUsage?: (usage: BrowseUsage | null) => void }): Promise<BrowsePlace[]> {
  if (!call.destination.trim()) throw new PlaceError("browse.destination");
  if (!call.baseUrl) throw new PlaceError("place.noServer");
  if (!call.credential) throw new PlaceError("place.signIn");
  let response: Response;
  try {
    response = await fetchWithTimeout(`${call.baseUrl.replace(/\/+$/, "")}/api/browse-places`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${call.credential}` },
      // 숙소 근처로 찾을 때만 숙소 위치를 약 100m 단위로 줄여 보낸다.
      body: JSON.stringify({ destination: call.destination.trim(), category: call.category, language: placeLanguage(call.lang), ...(call.near ? { near: roundNear(call.near) } : {}) }), signal: call.signal,
    }, { fetchImpl: call.fetchImpl, timeoutMs: 35_000 });
    if (response.status === 401) throw new PlaceError("place.signIn");
    if (response.status === 404) throw new PlaceError("place.noServer");
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      call.onUsage?.(null);
      if (response.status === 429) throw new PlaceError(error?.code === "SEARCH_QUOTA_EXCEEDED" ? "browse.quota" : "browse.rate");
      // 추천 후보를 모르는 예전 서버는 분류 값을 400으로 거절한다. 부른 쪽이 분류 검색으로 대신한다.
      if (response.status === 400 && call.category === PICKS) throw new PlaceError("pick.oldServer");
      if (error?.code === "SEARCH_PAUSED" || error?.code === "SEARCH_BUDGET_EXCEEDED") throw new PlaceError("browse.paused");
      if (error?.code === "SEARCH_USAGE_UNAVAILABLE") throw new PlaceError("place.noServer");
      throw new PlaceError(response.status === 504 ? "place.slow" : "browse.failed");
    }
    const payload = await response.json();
    if (!Array.isArray(payload?.places)) throw new PlaceError("browse.failed");
    call.onUsage?.(readUsage(payload.usage));
    return payload.places.filter((p: BrowsePlace) => p && typeof p.placeId === "string" && /^[A-Za-z0-9_-]{10,300}$/.test(p.placeId) && typeof p.name === "string" && p.name.trim() && typeof p.address === "string" && typeof p.type === "string")
      .slice(0, call.category === PICKS ? PICKS_MAX_PLACES : BROWSE_MAX_PLACES).map((p: BrowsePlace) => ({ placeId: p.placeId, name: p.name, address: p.address, type: p.type,
        ...(typeof p.rating === "number" && p.rating >= 1 && p.rating <= 5 ? { rating: p.rating } : {}),
        ...(Number.isSafeInteger(p.reviews) && Number(p.reviews) >= 0 ? { reviews: p.reviews } : {}),
        ...(p.photo && isGooglePhotoUri(p.photo.uri) && Array.isArray(p.photo.authors) && p.photo.authors.every(a => typeof a === "string") ? { photo: p.photo } : {}),
        ...(p.location && Number.isFinite(p.location.latitude) && Number.isFinite(p.location.longitude) && Math.abs(p.location.latitude) <= 90 && Math.abs(p.location.longitude) <= 180 ? { location: { latitude: p.location.latitude, longitude: p.location.longitude } } : {}),
        ...(typeof p.primaryType === "string" && /^[a-z_]{2,60}$/.test(p.primaryType) ? { primaryType: p.primaryType } : {}),
        ...(Array.isArray(p.hours) && p.hours.length <= 28 && p.hours.every(isWeeklyHours) ? { hours: p.hours.map(h => ({ open: h.open, close: h.close })) } : {}),
        ...(Number.isInteger(p.priceLevel) && Number(p.priceLevel) >= 0 && Number(p.priceLevel) <= 4 ? { priceLevel: p.priceLevel } : {}),
      }));
  } catch (error) {
    if (error instanceof PlaceError) throw error;
    // 사용자가 취소한 요청도 예전처럼 place.slow로 끝낸다. 화면은 취소된 요청의 결과를 버린다.
    throw new PlaceError(isFetchTimeout(error) || call.signal?.aborted ? "place.slow" : "auth.offline");
  }
}
export function browsePlaceToPage(place: BrowsePlace, tripId: string, id: string, date: string): PageEntry {
  return { id, tripId, kind: "place", title: place.name, date, body: "", address: place.address, placeId: place.placeId, done: false };
}
