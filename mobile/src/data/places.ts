import { KeyedError } from "../i18n/errors";
import type { Lang } from "../i18n/strings";
import { limitKey } from "./usageLimit";
import { fetchWithTimeout, isFetchTimeout } from "./fetchWithTimeout";

// 장소 찾기와 지도 위치. 앱 서버(/api/place)를 거쳐 Google Places에서 받는다.
// Google 정책상 좌표는 30일까지만 둘 수 있어서 수첩(계정 백업)에는 넣지 않고 기기 캐시에만 둔다.
// 수첩에는 장소 ID만 남기고, 캐시가 지나면 그 ID로 다시 받는다.

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  detail: string;
}

export interface PlacePoint {
  placeId: string;
  latitude: number;
  longitude: number;
  address: string;
}

/** 기기 캐시 한 칸. at은 받은 시각(ISO). */
export interface CachedPoint {
  latitude: number;
  longitude: number;
  placeId?: string;
  at: string;
}

export class PlaceError extends KeyedError {}

/** 좌표를 둘 수 있는 최대 날짜 수(Places API 정책). */
export const LOCATION_DAYS = 30;
const DAY_MS = 86_400_000;

export function placeLanguage(lang: Lang): "ko" | "en" | "ja" {
  return lang === "ko" ? "ko" : lang === "ja" ? "ja" : "en";
}

/** 캐시 열쇠. 장소 ID가 있으면 그것, 없으면 손으로 적은 주소. 둘 다 없으면 null. */
export function cacheKey(target: { placeId?: string; address?: string }): string | null {
  if (target.placeId) return `id:${target.placeId}`;
  const address = target.address?.trim().replace(/\s+/g, " ").toLowerCase();
  return address ? `addr:${address}` : null;
}

/** 받은 지 30일이 안 지났는지. 지났으면 지우고 다시 받아야 한다. */
export function isFresh(entry: CachedPoint, now: Date): boolean {
  const at = Date.parse(entry.at);
  return Number.isFinite(at) && now.getTime() - at < LOCATION_DAYS * DAY_MS && at <= now.getTime() + DAY_MS;
}

export function parseCachedPoint(raw: string | null): CachedPoint | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!isLatitude(v?.latitude) || !isLongitude(v?.longitude) || typeof v?.at !== "string") return null;
    return { latitude: v.latitude, longitude: v.longitude, at: v.at, ...(typeof v.placeId === "string" ? { placeId: v.placeId } : {}) };
  } catch {
    return null;
  }
}

/** 장소 찾기 한 번(자동완성 여러 번 + 마지막 위치 받기)을 묶는 토큰. 요금이 한 번으로 계산된다. */
export function newSessionToken(random: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
}

interface Call {
  baseUrl: string;
  credential: string;
  lang: Lang;
  fetchImpl?: typeof fetch;
}

async function post(call: Call, body: Record<string, unknown>): Promise<unknown> {
  if (!call.baseUrl) throw new PlaceError("place.noServer");
  let response: Response;
  try {
    response = await fetchWithTimeout(`${call.baseUrl.replace(/\/+$/, "")}/api/${call.credential ? "place" : "guest-place"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(call.credential ? { Authorization: `Bearer ${call.credential}` } : {}) },
      body: JSON.stringify({ ...body, language: placeLanguage(call.lang) }),
    }, { fetchImpl: call.fetchImpl });
  } catch (error) {
    throw new PlaceError(isFetchTimeout(error) ? "place.slow" : "auth.offline");
  }
  if (response.status === 401) throw new PlaceError("place.signIn");
  if (response.status === 429) throw new PlaceError(await limitKey(response));
  if (!response.ok) throw new PlaceError(response.status === 504 ? "place.slow" : "place.failed");
  return response.json().catch(() => null);
}

export async function suggestPlaces(call: Call & { text: string; sessionToken: string }): Promise<PlaceSuggestion[]> {
  const body = (await post(call, { action: "suggest", text: call.text.trim().slice(0, 120), sessionToken: call.sessionToken })) as { suggestions?: unknown } | null;
  return Array.isArray(body?.suggestions) ? body.suggestions.filter(isSuggestion) : [];
}

export async function locatePlace(call: Call & { placeId: string; sessionToken?: string }): Promise<PlacePoint> {
  const body = (await post(call, { action: "locate", placeId: call.placeId, ...(call.sessionToken ? { sessionToken: call.sessionToken } : {}) })) as { place?: unknown } | null;
  if (!isPoint(body?.place)) throw new PlaceError("place.failed");
  return body.place;
}

/** 손으로 적은 주소·이름 한 줄을 지도 위치로. 못 찾으면 null. */
export async function findPlace(call: Call & { text: string }): Promise<PlacePoint | null> {
  const body = (await post(call, { action: "find", text: call.text.trim().slice(0, 120) })) as { place?: unknown } | null;
  return isPoint(body?.place) ? body.place : null;
}

function isSuggestion(value: unknown): value is PlaceSuggestion {
  const v = value as PlaceSuggestion;
  return !!v && typeof v.placeId === "string" && typeof v.name === "string" && !!v.name.trim() && typeof v.detail === "string";
}

function isPoint(value: unknown): value is PlacePoint {
  const v = value as PlacePoint;
  return !!v && typeof v.placeId === "string" && isLatitude(v.latitude) && isLongitude(v.longitude) && typeof v.address === "string";
}

function isLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}
