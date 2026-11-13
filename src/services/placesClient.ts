import type {
  PlaceSummary,
  RestaurantCandidate,
} from "../domain/places/types";

export type PlacesClientErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "SERVER_CONFIG_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "OUTSIDE_REGION"
  | "OUTSIDE_TRIP_WINDOW"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_PROVIDER_ERROR"
  | "UPSTREAM_SCHEMA_ERROR"
  | UsageLimitCode
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

const serverErrorCodes = new Set<PlacesClientErrorCode>([
  "METHOD_NOT_ALLOWED",
  "SERVER_CONFIG_ERROR",
  "UNAUTHORIZED",
  "INVALID_REQUEST",
  "OUTSIDE_REGION",
  "OUTSIDE_TRIP_WINDOW",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_PROVIDER_ERROR",
  "UPSTREAM_SCHEMA_ERROR",
  "RATE_LIMITED",
  "DAILY_LIMIT_REACHED",
  "SERVICE_LIMIT_REACHED",
]);

// 서버가 429로 Google 호출을 막았을 때의 코드와 짧은 안내. 웹 화면은 한국어지만 여행자 브라우저 언어에 맞춰 한·영·일 중 고른다.
export type UsageLimitCode = "RATE_LIMITED" | "DAILY_LIMIT_REACHED" | "SERVICE_LIMIT_REACHED";

const usageLimitMessages: Record<UsageLimitCode, [ko: string, en: string, ja: string]> = {
  RATE_LIMITED: ["요청이 많아요. 잠시 후 다시 시도해 주세요.", "Too many requests. Try again in a moment.", "リクエストが多すぎます。少し待ってからお試しください。"],
  DAILY_LIMIT_REACHED: ["오늘 이용 한도를 모두 썼어요. 직접 입력은 계속할 수 있어요.", "You've reached today's limit. You can still type places yourself.", "本日の利用上限に達しました。手入力は引き続きできます。"],
  SERVICE_LIMIT_REACHED: ["지금은 이용이 많아 잠시 쉬고 있어요. 나중에 다시 시도해 주세요.", "This feature is resting due to high demand. Try again later.", "利用が集中しているため一時休止中です。後でお試しください。"],
};

/** 한도 코드면 안내 문구, 아니면 null. */
export function usageLimitMessage(code: PlacesClientErrorCode, languages: readonly string[] = globalThis.navigator?.languages ?? []): string | null {
  if (!Object.hasOwn(usageLimitMessages, code)) return null;
  const preferred = languages.find((language) => /^(ko|en|ja)\b/i.test(language))?.slice(0, 2).toLowerCase() ?? "ko";
  return usageLimitMessages[code as UsageLimitCode][preferred === "en" ? 1 : preferred === "ja" ? 2 : 0];
}

export class PlacesClientError extends Error {
  readonly status: number;
  readonly code: PlacesClientErrorCode;

  constructor(status: number, code: PlacesClientErrorCode) {
    super("장소 정보를 불러오지 못했습니다.");
    this.name = "PlacesClientError";
    this.status = status;
    this.code = code;
  }
}

export interface SearchPlacesInput {
  query: string;
  center?: { latitude: number; longitude: number };
}

export interface SearchPlacesResponse {
  places: PlaceSummary[];
  fetchedAt: string;
}

export interface FetchRestaurantsInput {
  center: { latitude: number; longitude: number };
  radius: "near" | "wide";
}

export interface FetchRestaurantsResponse {
  restaurants: RestaurantCandidate[];
  fetchedAt: string;
}

export async function searchPlaces(
  input: SearchPlacesInput,
  accessToken: string,
  signal: AbortSignal,
): Promise<SearchPlacesResponse> {
  const body = await postJson("/api/places-search", input, accessToken, signal);
  if (
    !isRecord(body) ||
    typeof body.fetchedAt !== "string" ||
    !Array.isArray(body.places) ||
    !body.places.every(isPlaceSummary)
  ) {
    throw new PlacesClientError(502, "INVALID_RESPONSE");
  }
  return { places: body.places, fetchedAt: body.fetchedAt };
}

export async function fetchRestaurants(
  input: FetchRestaurantsInput,
  accessToken: string,
  signal: AbortSignal,
): Promise<FetchRestaurantsResponse> {
  const body = await postJson(
    "/api/places-restaurants",
    input,
    accessToken,
    signal,
  );
  if (
    !isRecord(body) ||
    typeof body.fetchedAt !== "string" ||
    !Array.isArray(body.restaurants) ||
    !body.restaurants.every(isRestaurantCandidate)
  ) {
    throw new PlacesClientError(502, "INVALID_RESPONSE");
  }
  return { restaurants: body.restaurants, fetchedAt: body.fetchedAt };
}

async function postJson(
  path: string,
  input: unknown,
  accessToken: string,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new PlacesClientError(0, "NETWORK_ERROR");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw new PlacesClientError(502, "INVALID_RESPONSE");
  }

  if (!response.ok) {
    throw new PlacesClientError(response.status, readServerErrorCode(body));
  }
  return body;
}

function readServerErrorCode(body: unknown): PlacesClientErrorCode {
  if (!isRecord(body) || typeof body.code !== "string") return "UNKNOWN";
  return serverErrorCodes.has(body.code as PlacesClientErrorCode)
    ? (body.code as PlacesClientErrorCode)
    : "UNKNOWN";
}

function isPlaceSummary(value: unknown): value is PlaceSummary {
  return (
    isRecord(value) &&
    typeof value.placeId === "string" &&
    value.placeId.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    typeof value.formattedAddress === "string" &&
    isRecord(value.location) &&
    typeof value.location.latitude === "number" &&
    typeof value.location.longitude === "number" &&
    typeof value.googleMapsUri === "string" &&
    value.googleMapsUri.startsWith("https://")
  );
}

function isRestaurantCandidate(value: unknown): value is RestaurantCandidate {
  return (
    isPlaceSummary(value) &&
    typeof (value as RestaurantCandidate).distanceMeters === "number" &&
    ((value as RestaurantCandidate).rating === undefined ||
      typeof (value as RestaurantCandidate).rating === "number") &&
    ((value as RestaurantCandidate).openNow === undefined ||
      typeof (value as RestaurantCandidate).openNow === "boolean")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}
