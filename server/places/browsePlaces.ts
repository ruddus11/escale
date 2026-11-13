import { BROWSE_MAX_PLACES, NEAR_RADIUS_M, PICKS, PICKS_MAX_PLACES, PICKS_RADIUS_M, WEEK_MINUTES, browsePrimaryTypes, browseTypes, isGooglePhotoUri, pickTypes, roundNear, type BrowseCategory, type BrowseNear, type BrowsePlace, type WeeklyHours } from "../../src/domain/places/browse.js";
import { isPlaceId, type PlaceLanguage } from "./googlePlaceLookup.js";
import { PlacesServiceError } from "./googlePlacesClient.js";

export type PlaceBrowser = (input: { destination: string; category: BrowseCategory | typeof PICKS; language: PlaceLanguage; near?: BrowseNear }) => Promise<BrowsePlace[]>;
const fields = "places.id,places.displayName,places.formattedAddress,places.types,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.photos,places.businessStatus";
// 추천 후보는 사진 대신 위치·영업시간·가격대를 받는다. 평점과 같은 요금 등급(Enterprise)이라 검색 단가는 그대로다.
const pickFields = "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.businessStatus,places.regularOpeningHours,places.priceLevel";
const PRICE_LEVELS: Record<string, number> = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const diagnosticWords = new Set(["api", "key", "keys", "request", "requests", "caller", "callers", "unregistered", "established", "identity", "consumer", "credentials", "authentication", "authorization", "permission", "denied", "forbidden", "invalid", "valid", "missing", "expired", "leaked", "revoked", "deleted", "disabled", "enabled", "activated", "supported", "unsupported", "restricted", "restrictions", "blocked", "authorized", "unauthorized", "billing", "payment", "suspended", "closed", "quota", "exceeded", "project", "service", "not", "without", "must", "enable"]);

function messageHints(message: unknown): string[] {
  if (typeof message !== "string") return [];
  // 원문이나 임의의 단어를 남기지 않고 설정 진단용 고정 어휘만 반환한다.
  return [...new Set((message.toLowerCase().match(/[a-z]+/g) ?? []).filter(word => diagnosticWords.has(word)))];
}

// 원문에는 검색어나 키가 섞일 수 있어 설정 오류의 종류만 분류한다.
function configurationIssue(message: unknown) {
  if (typeof message !== "string") return "UNKNOWN";
  if (/key.*(?:leaked|revoked|deleted)/i.test(message)) return "API_KEY_REVOKED";
  if (/billing|payment/i.test(message)) return "BILLING";
  if (/API key.*(?:invalid|expired|not valid)|expired.*API key/i.test(message)) return "API_KEY_INVALID";
  if (/has not been used|(?:API|service).*disabled|(?:API|service).*not enabled/i.test(message)) return "API_DISABLED";
  if (/refer+er|referrer|IP address|blocked|not authorized|restriction|not allowed/i.test(message)) return "API_KEY_RESTRICTION";
  return "UNKNOWN";
}

/** One category request, at most ten photos. No Jev calls or stored search history. */
export function createPlaceBrowser(dependencies: { apiKey: string; fetch?: typeof fetch }): PlaceBrowser {
  const fetchImpl = dependencies.fetch ?? fetch;
  async function call(url: string, body?: Record<string, unknown>, mask = fields) {
    try {
      const response = await fetchImpl(url, {
        method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(8_000),
        headers: { "X-Goog-Api-Key": dependencies.apiKey, ...(body ? { "Content-Type": "application/json", "X-Goog-FieldMask": mask } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      } as RequestInit);
      if (!response.ok) {
        // 제공자 응답 본문에는 검색어가 들어갈 수 있어 상태·이유 코드만 운영 기록에 남긴다.
        const payload: unknown = await response.json().catch(() => null);
        const error = record(payload) && record(payload.error) ? payload.error : {};
        const code = (v: unknown) => typeof v === "string" && /^[A-Z][A-Z_0-9]{0,79}$/.test(v) ? v : undefined;
        const reasons = Array.isArray(error.details) ? error.details.flatMap(detail => record(detail) && code(detail.reason) ? [code(detail.reason)] : []) : [];
        console.error("PLACE_BROWSE_PROVIDER_ERROR", { operation: body ? "search" : "photo", httpStatus: response.status, status: code(error.status), reasons, configuration: configurationIssue(error.message), hints: messageHints(error.message) });
        throw new PlacesServiceError("UPSTREAM_PROVIDER_ERROR");
      }
      const result: unknown = await response.json();
      if (!record(result)) throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
      return result;
    } catch (error) {
      if (error instanceof PlacesServiceError) throw error;
      throw new PlacesServiceError(error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROVIDER_ERROR");
    }
  }
  async function picks(language: PlaceLanguage, near: BrowseNear): Promise<BrowsePlace[]> {
    // 인기순 근처 검색은 식당이 자리를 다 차지하기 쉬워 먹을 곳과 볼 곳을 따로 스무 곳씩 받는다.
    const search = (types: readonly string[]) => call("https://places.googleapis.com/v1/places:searchNearby", {
      includedTypes: types, maxResultCount: 20, rankPreference: "POPULARITY", languageCode: language,
      locationRestriction: { circle: { center: roundNear(near), radius: PICKS_RADIUS_M } },
    }, pickFields);
    const payloads = await Promise.all([search(pickTypes.eat), search(pickTypes.see)]);
    const seen = new Set<string>();
    const places: BrowsePlace[] = [];
    for (const payload of payloads) {
      if (payload.places !== undefined && !Array.isArray(payload.places)) throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
      for (const v of Array.isArray(payload.places) ? payload.places : []) {
        if (!record(v) || !isPlaceId(v.id) || seen.has(v.id) || !record(v.displayName) || !text(v.displayName.text) || v.businessStatus === "CLOSED_PERMANENTLY" || v.businessStatus === "CLOSED_TEMPORARILY") continue;
        const location = record(v.location) && typeof v.location.latitude === "number" && typeof v.location.longitude === "number" ? { latitude: v.location.latitude, longitude: v.location.longitude } : null;
        if (!location) continue;
        seen.add(v.id);
        const place: BrowsePlace = { placeId: v.id, name: text(v.displayName.text), address: text(v.formattedAddress), type: record(v.primaryTypeDisplayName) ? text(v.primaryTypeDisplayName.text) : "", location };
        if (typeof v.primaryType === "string" && /^[a-z_]{2,60}$/.test(v.primaryType)) place.primaryType = v.primaryType;
        if (typeof v.rating === "number" && v.rating >= 1 && v.rating <= 5) place.rating = v.rating;
        if (Number.isSafeInteger(v.userRatingCount) && Number(v.userRatingCount) >= 0) place.reviews = Number(v.userRatingCount);
        const hours = weeklyHours(v.regularOpeningHours);
        if (hours) place.hours = hours;
        if (typeof v.priceLevel === "string" && v.priceLevel in PRICE_LEVELS) place.priceLevel = PRICE_LEVELS[v.priceLevel];
        places.push(place);
      }
    }
    return places.slice(0, PICKS_MAX_PLACES);
  }
  return async ({ destination, category, language, near }) => {
    if (category === PICKS) {
      if (!near) throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
      return picks(language, near);
    }
    const includedType = browseTypes[category];
    const primaryTypes = browsePrimaryTypes[category];
    // 숙소 근처는 그 둘레 안에서 인기순으로, 아니면 여행지 이름으로 찾는다. 닫은 곳·분류에 안 맞는 곳을 걸러도 열 곳이 남도록 Google 최대치인 스무 곳을 받는다.
    // 검색 요금은 받는 장소 수와 상관없이 요청 한 번이다. 사진은 보여 줄 장소마다 따로 든다.
    const payload = near
      ? await call("https://places.googleapis.com/v1/places:searchNearby", {
          includedTypes: [includedType], ...(primaryTypes ? { includedPrimaryTypes: primaryTypes } : {}), maxResultCount: 20, rankPreference: "POPULARITY", languageCode: language,
          locationRestriction: { circle: { center: roundNear(near), radius: NEAR_RADIUS_M } },
        })
      : await call("https://places.googleapis.com/v1/places:searchText", {
          textQuery: `${destination} ${includedType.replaceAll("_", " ")}`, includedType, strictTypeFiltering: true, languageCode: language, pageSize: 20,
        });
    if (payload.places !== undefined && !Array.isArray(payload.places)) throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
    // Text Search에는 대표 유형 조건이 없어 응답의 primaryType으로 거른다. 근처 검색도 Google이 더 세부적인 대표 유형을 섞어 줄 수 있어 같은 목록으로 다시 본다.
    const seen = new Set<string>();
    const rows = (Array.isArray(payload.places) ? payload.places : []).filter((v): v is Record<string, unknown> => {
      if (!record(v) || !isPlaceId(v.id) || seen.has(v.id) || !record(v.displayName) || !text(v.displayName.text) || !Array.isArray(v.types) || !v.types.includes(includedType) || (primaryTypes && !(typeof v.primaryType === "string" && primaryTypes.includes(v.primaryType))) || v.businessStatus === "CLOSED_PERMANENTLY" || v.businessStatus === "CLOSED_TEMPORARILY") return false;
      seen.add(v.id); return true;
    }).slice(0, BROWSE_MAX_PLACES);
    return Promise.all(rows.map(async (v): Promise<BrowsePlace> => {
      const place: BrowsePlace = { placeId: String(v.id), name: text((v.displayName as Record<string, unknown>).text), address: text(v.formattedAddress), type: record(v.primaryTypeDisplayName) ? text(v.primaryTypeDisplayName.text) : "" };
      if (typeof v.rating === "number" && v.rating >= 1 && v.rating <= 5) place.rating = v.rating;
      if (Number.isSafeInteger(v.userRatingCount) && Number(v.userRatingCount) >= 0) place.reviews = Number(v.userRatingCount);
      const photo = Array.isArray(v.photos) ? v.photos[0] : undefined;
      if (record(photo) && typeof photo.name === "string" && /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)) {
        try {
          const media = await call(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=640&skipHttpRedirect=true`);
          const authors = Array.isArray(photo.authorAttributions) ? photo.authorAttributions.flatMap(a => record(a) && text(a.displayName) ? [text(a.displayName)] : []) : [];
          if (isGooglePhotoUri(media.photoUri)) place.photo = { uri: media.photoUri, authors };
        } catch { /* A missing photo must not hide a usable place. */ }
      }
      return place;
    }));
  };
}

/**
 * Google 정기 영업시간을 일요일 0시부터 센 분 구간으로 바꾼다. 읽을 수 없으면 undefined(모름)로 둔다.
 * 끝(close)이 없는 한 구간은 Google이 24시간 영업을 나타내는 방식이다.
 */
export function weeklyHours(value: unknown): WeeklyHours[] | undefined {
  if (!record(value) || !Array.isArray(value.periods) || !value.periods.length) return undefined;
  const at = (point: unknown) => record(point) && Number.isInteger(point.day) && Number(point.day) >= 0 && Number(point.day) <= 6 && Number.isInteger(point.hour) && Number(point.hour) >= 0 && Number(point.hour) <= 24 && Number.isInteger(point.minute ?? 0) && Number(point.minute ?? 0) >= 0 && Number(point.minute ?? 0) < 60
    ? Number(point.day) * 1440 + Number(point.hour) * 60 + Number(point.minute ?? 0) : null;
  if (value.periods.length === 1 && record(value.periods[0]) && value.periods[0].close === undefined && at(value.periods[0].open) === 0) return [{ open: 0, close: WEEK_MINUTES }];
  const hours: WeeklyHours[] = [];
  for (const period of value.periods.slice(0, 28)) {
    if (!record(period)) return undefined;
    const open = at(period.open), close = at(period.close);
    if (open === null || close === null || open === close) return undefined;
    hours.push({ open, close });
  }
  return hours;
}
