import type { Coordinates } from "../http/guards.js";
import { PlacesServiceError } from "./googlePlacesClient.js";

// 계획·장소 입력에서 쓰는 장소 찾기. Places API (New)의 가장 싼 조합만 쓴다.
// - 자동완성: 세션 토큰으로 묶어 마지막 위치 받기와 한 번으로 계산된다.
// - 위치 받기(Place Details Essentials): location, formattedAddress만 받는다. 월 1만 건 무료.
// - 주소로 찾기(Text Search IDs Only): 장소 ID만 받아 무료다. 위치는 위치 받기로 다시 받는다.
// 받은 위치는 앱이 기기에만 30일까지 둔다(Places API 정책). 서버는 짧은 함수 메모리 캐시만 쓴다.

const AUTOCOMPLETE_ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places/";
const SEARCH_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_SUGGESTIONS = 5;
// 검색 기준점 주변을 먼저 보여 준다. 미터 단위, Places API 최대값.
const BIAS_RADIUS_METERS = 50_000;

export type PlaceLanguage = "ko" | "en" | "ja";

export interface PlaceSuggestion {
  placeId: string;
  /** 장소 이름. 예: "Lisbon Cathedral" */
  name: string;
  /** 이름 아래 한 줄. 예: "Largo da Sé, Lisboa, Portugal" */
  detail: string;
}

export interface PlaceLocation {
  placeId: string;
  latitude: number;
  longitude: number;
  address: string;
}

export interface PlaceLookup {
  suggest(input: { text: string; sessionToken: string; language: PlaceLanguage; near?: Coordinates }): Promise<PlaceSuggestion[]>;
  locate(input: { placeId: string; sessionToken?: string; language: PlaceLanguage }): Promise<PlaceLocation>;
  /** 주소나 이름 한 줄에 맞는 첫 장소의 ID. 없으면 null. */
  find(input: { text: string; language: PlaceLanguage }): Promise<string | null>;
}

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

export function isPlaceId(value: unknown): value is string {
  return typeof value === "string" && PLACE_ID.test(value);
}

export function createGooglePlaceLookup(dependencies: { apiKey: string; fetch?: typeof globalThis.fetch }): PlaceLookup {
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;

  async function call(url: string, fieldMask: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: body ? "POST" : "GET",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          "X-Goog-Api-Key": dependencies.apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      } as RequestInit);
    } catch (error) {
      throw new PlacesServiceError(isTimeout(error) ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROVIDER_ERROR");
    }
    if (!response.ok) throw new PlacesServiceError("UPSTREAM_PROVIDER_ERROR");
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new PlacesServiceError(isTimeout(error) ? "UPSTREAM_TIMEOUT" : "UPSTREAM_SCHEMA_ERROR");
    }
    if (!isRecord(payload)) throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
    return payload;
  }

  return {
    async suggest({ text, sessionToken, language, near }) {
      const payload = await call(AUTOCOMPLETE_ENDPOINT, "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat", {
        input: text,
        sessionToken,
        languageCode: language,
        ...(near ? { locationBias: { circle: { center: near, radius: BIAS_RADIUS_METERS } } } : {}),
      });
      const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      return suggestions.flatMap((item): PlaceSuggestion[] => {
        const prediction = isRecord(item) && isRecord(item.placePrediction) ? item.placePrediction : null;
        const format = prediction && isRecord(prediction.structuredFormat) ? prediction.structuredFormat : null;
        const name = format && isRecord(format.mainText) && typeof format.mainText.text === "string" ? format.mainText.text.trim() : "";
        const detail = format && isRecord(format.secondaryText) && typeof format.secondaryText.text === "string" ? format.secondaryText.text.trim() : "";
        return prediction && isPlaceId(prediction.placeId) && name ? [{ placeId: prediction.placeId, name, detail }] : [];
      }).slice(0, MAX_SUGGESTIONS);
    },

    async locate({ placeId, sessionToken, language }) {
      const query = new URLSearchParams({ languageCode: language, ...(sessionToken ? { sessionToken } : {}) });
      const payload = await call(`${DETAILS_ENDPOINT}${encodeURIComponent(placeId)}?${query}`, "id,location,formattedAddress");
      const location = isRecord(payload.location) ? payload.location : null;
      const latitude = location?.latitude;
      const longitude = location?.longitude;
      if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude))
        throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
      return {
        placeId: isPlaceId(payload.id) ? payload.id : placeId,
        latitude,
        longitude,
        address: typeof payload.formattedAddress === "string" ? payload.formattedAddress.trim() : "",
      };
    },

    async find({ text, language }) {
      const payload = await call(SEARCH_TEXT_ENDPOINT, "places.id", { textQuery: text, languageCode: language, pageSize: 1 });
      const first = Array.isArray(payload.places) ? payload.places[0] : undefined;
      return isRecord(first) && isPlaceId(first.id) ? first.id : null;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
