import type { VercelApiHandler } from "@vercel/node";
import {
  checkSignedInAccess,
  createSupabaseUserLookup,
  type PaidAccessEnvironment,
  type UserLookup,
} from "../server/security/paidAccess.js";
import { hasOnlyKeys, readCoordinates, sendJson, setSafeResponseHeaders, type Coordinates } from "../server/http/guards.js";
import { PlacesServiceError } from "../server/places/googlePlacesClient.js";
import { createGooglePlaceLookup, isPlaceId, type PlaceLanguage, type PlaceLocation, type PlaceLookup, type PlaceSuggestion } from "../server/places/googlePlaceLookup.js";
import { clientIdentity, CostLimitError, createDefaultRouteGuard, sendLimited, type RouteGuard } from "../server/security/costGuard.js";
import { createResponseCache, isCacheOff, normalizeText, type ResponseCache } from "../server/security/responseCache.js";

// 계획·가고 싶은 곳을 적을 때 장소를 찾고 지도에 찍을 위치를 받는다.
// 무료 기능이지만 구글 사용량이 들어서 로그인한 사람(또는 개인 접근 코드)만 쓴다.
// 검색어 원문은 저장하지 않는다. 같은 요청은 해시 열쇠로 함수 메모리에서만 잠깐(5~30분) 다시 쓴다.

const MAX_TEXT_LENGTH = 120;
const SESSION_TOKEN = /^[A-Za-z0-9-]{8,64}$/;
const LANGUAGES: PlaceLanguage[] = ["ko", "en", "ja"];
// 자동완성 결과는 자주 바뀌지 않지만 입력 중 반복이 많아 짧게, 위치는 조금 길게 둔다.
const SUGGEST_TTL_MS = 5 * 60_000;
const LOCATION_TTL_MS = 30 * 60_000;

interface PlaceEnvironment extends PaidAccessEnvironment {
  GOOGLE_MAPS_API_KEY?: string;
}

export interface PlaceHandlerDependencies {
  /** 별도 손님 경로에서만 켠다. 기존 인증 경로는 기본값을 유지한다. */
  allowGuests?: boolean;
  env: PlaceEnvironment;
  createLookup: (apiKey: string) => PlaceLookup;
  lookupUser?: UserLookup | null;
  guard: RouteGuard;
  cache: ResponseCache<PlaceAnswer>;
}

export type PlaceAnswer = { suggestions: PlaceSuggestion[] } | { place: PlaceLocation | null };

type Request =
  | { action: "suggest"; text: string; sessionToken: string; language: PlaceLanguage; near?: Coordinates }
  | { action: "locate"; placeId: string; sessionToken?: string; language: PlaceLanguage }
  | { action: "find"; text: string; language: PlaceLanguage };

export function createPlaceHandler(dependencies: PlaceHandlerDependencies): VercelApiHandler {
  return async (request, response) => {
    setSafeResponseHeaders(response);
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, "METHOD_NOT_ALLOWED");
      return;
    }

    const access = dependencies.allowGuests ? { ok: true as const, userId: null } : await checkSignedInAccess(dependencies.env, request.headers.authorization, dependencies.lookupUser ?? null);
    if (!access.ok) {
      sendJson(response, access.status, access.code);
      return;
    }

    const apiKey = dependencies.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      sendJson(response, 503, "SERVER_CONFIG_ERROR");
      return;
    }

    const parsed = parseRequest(request.body);
    if (!parsed) {
      sendJson(response, 400, "INVALID_REQUEST");
      return;
    }

    const key = cacheKey(parsed);
    try {
      // 손님 경로는 캐시 응답도 IP 한도에 포함해 공개 경로의 반복 호출을 제한한다.
      if (dependencies.allowGuests) {
        const decision = await dependencies.guard.admit(clientIdentity(null, request.headers));
        if (!decision.allowed) throw new CostLimitError(decision);
      }
      const cached = key ? dependencies.cache.peek(key) : undefined;
      if (cached) {
        response.status(200).json(await cached);
        return;
      }
      const load = async (): Promise<PlaceAnswer> => {
        // 같은 열쇠의 동시 요청은 한 번만 예약하고 한 번만 Google을 부른다.
        if (!dependencies.allowGuests) {
          const decision = await dependencies.guard.admit(clientIdentity(access.userId, request.headers));
          if (!decision.allowed) throw new CostLimitError(decision);
        }
        const lookup = dependencies.createLookup(apiKey);
        if (parsed.action === "suggest") {
          const { action: _action, ...input } = parsed;
          return { suggestions: await lookup.suggest(input) };
        }
        if (parsed.action === "locate") {
          const { action: _action, ...input } = parsed;
          return { place: await lookup.locate(input) };
        }
        const placeId = await lookup.find({ text: parsed.text, language: parsed.language });
        return { place: placeId ? await lookup.locate({ placeId, language: parsed.language }) : null };
      };
      response.status(200).json(key ? await dependencies.cache.remember(key, load, parsed.action === "suggest" ? SUGGEST_TTL_MS : LOCATION_TTL_MS) : await load());
    } catch (error) {
      if (error instanceof CostLimitError) {
        sendLimited(response, error.decision);
        return;
      }
      if (error instanceof PlacesServiceError) {
        sendJson(response, error.code === "UPSTREAM_TIMEOUT" ? 504 : 502, error.code);
        return;
      }
      sendJson(response, 502, "UPSTREAM_PROVIDER_ERROR");
    }
  };
}

/**
 * 세션 토큰은 열쇠에서 뺀다. 같은 글자를 다른 사람이 쳐도 같은 결과다.
 * 세션을 끝내는 위치 받기(세션 토큰 있음)는 기억한 값으로 답하지 않는다. Google은 위치 받기로 끝나지 않은
 * 자동완성 세션의 요청을 한 건씩 따로 청구하므로, 여기서 아끼면 오히려 비용이 늘 수 있다.
 */
function cacheKey(parsed: Request): string | null {
  switch (parsed.action) {
    case "suggest":
      return `suggest:${parsed.language}:${parsed.near ? `${parsed.near.latitude},${parsed.near.longitude}` : "-"}:${normalizeText(parsed.text)}`;
    case "locate":
      return parsed.sessionToken ? null : `locate:${parsed.language}:${parsed.placeId}`;
    case "find":
      return `find:${parsed.language}:${normalizeText(parsed.text)}`;
  }
}

function parseRequest(body: unknown): Request | null {
  if (!hasOnlyKeys(body, ["action", "text", "placeId", "sessionToken", "language", "near"], ["action", "language"])) return null;
  const language = LANGUAGES.find((l) => l === body.language);
  if (!language) return null;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const sessionToken = typeof body.sessionToken === "string" && SESSION_TOKEN.test(body.sessionToken) ? body.sessionToken : undefined;
  if (body.sessionToken !== undefined && !sessionToken) return null;
  const textOk = text.length > 0 && text.length <= MAX_TEXT_LENGTH;
  switch (body.action) {
    case "suggest": {
      if (!textOk || !sessionToken || body.placeId !== undefined) return null;
      if (body.near === undefined) return { action: "suggest", text, sessionToken, language };
      const near = readCoordinates(body.near);
      // 기준점은 반경 50km 치우침에만 쓰이므로 약 1km 단위로 줄여 같은 동네의 검색을 같은 요청으로 묶는다.
      return near ? { action: "suggest", text, sessionToken, language, near: roundCoordinates(near, 100) } : null;
    }
    case "locate":
      return isPlaceId(body.placeId) && body.text === undefined && body.near === undefined
        ? { action: "locate", placeId: body.placeId, language, ...(sessionToken ? { sessionToken } : {}) }
        : null;
    case "find":
      return textOk && body.placeId === undefined && body.sessionToken === undefined && body.near === undefined ? { action: "find", text, language } : null;
    default:
      return null;
  }
}

function roundCoordinates(point: Coordinates, scale: number): Coordinates {
  return { latitude: Math.round(point.latitude * scale) / scale, longitude: Math.round(point.longitude * scale) / scale };
}

export default createPlaceHandler({
  env: process.env,
  createLookup: (apiKey) => createGooglePlaceLookup({ apiKey }),
  lookupUser: createSupabaseUserLookup(process.env),
  guard: createDefaultRouteGuard("PLACE", process.env),
  cache: createResponseCache({ ttlMs: SUGGEST_TTL_MS, maxEntries: 1_000, disabled: isCacheOff(process.env) }),
});
