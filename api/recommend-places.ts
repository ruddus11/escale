import type { VercelApiHandler } from "@vercel/node";
import { APITimeoutError } from "@typesafe-ai/sdk";
import {
  checkPaidAccess,
  createSupabaseMemberLookup,
  type MemberLookup,
  type PaidAccessEnvironment,
} from "../server/security/paidAccess.js";
import {
  hasOnlyKeys,
  sendJson,
  setSafeResponseHeaders,
} from "../server/http/guards.js";
import {
  PlacesServiceError,
  createGooglePlacesClient,
  type GooglePlacesProvider,
} from "../server/places/googlePlacesClient.js";
import {
  recommendPlaces,
  type PlaceJudge,
  type PlaceRecommendation,
  type RecommendTrip,
} from "../server/recommendations/recommendPlaces.js";
import { createTypeSafePlaceJudge } from "../server/recommendations/typesafePlaceJudge.js";
import { clientIdentity, CostLimitError, createDefaultRouteGuard, sendLimited, type RouteGuard } from "../server/security/costGuard.js";
import { createResponseCache, isCacheOff, normalizeText, type ResponseCache } from "../server/security/responseCache.js";

const MAX_DESTINATION_LENGTH = 60;
const MAX_PREFERENCE_LENGTH = 120;
const MAX_TRAVELERS = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// 같은 여행 조건으로 다시 열거나 동행자가 같은 추천을 받을 때 Google 검색 4회와 Jev 판단을 아낀다.
const RECOMMEND_TTL_MS = 30 * 60_000;

interface HandlerClock {
  now(): Date;
}

interface RecommendPlacesEnvironment extends PaidAccessEnvironment {
  GOOGLE_MAPS_API_KEY?: string;
  TYPESAFE_API_KEY?: string;
}

export interface RecommendPlacesHandlerDependencies {
  clock: HandlerClock;
  env: RecommendPlacesEnvironment;
  createProvider: (apiKey: string) => GooglePlacesProvider;
  createJudge: (apiKey: string) => PlaceJudge;
  lookupMember?: MemberLookup | null;
  guard: RouteGuard;
  cache: ResponseCache<PlaceRecommendation[]>;
}

// 유료 기능. 로그인한 유료 회원(entitlements)이나 개인 접근 코드로만 연다.
export function createRecommendPlacesHandler(
  dependencies: RecommendPlacesHandlerDependencies,
): VercelApiHandler {
  return async (request, response) => {
    setSafeResponseHeaders(response);

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, "METHOD_NOT_ALLOWED");
      return;
    }

    const access = await checkPaidAccess(dependencies.env, request.headers.authorization, dependencies.lookupMember ?? null);
    if (access.ok === false) {
      sendJson(response, access.status, access.code);
      return;
    }

    const placesKey = dependencies.env.GOOGLE_MAPS_API_KEY?.trim();
    const typesafeKey = dependencies.env.TYPESAFE_API_KEY?.trim();
    if (!placesKey || !typesafeKey) {
      sendJson(response, 503, "SERVER_CONFIG_ERROR");
      return;
    }

    const trip = parseBody(request.body);
    if (trip === null) {
      sendJson(response, 400, "INVALID_REQUEST");
      return;
    }

    // 열쇠에는 계정·IP를 넣지 않는다. 결과(장소 목록)는 조건만으로 정해지므로 같은 조건이면 누구에게나 같다.
    // 취향 문장 원문은 캐시가 해시로 바꿔 둔다(responseCache.ts).
    const identity = clientIdentity(access.userId, request.headers);
    const key = JSON.stringify([normalizeText(trip.destination), normalizeText(trip.preference), trip.startDate, trip.endDate, trip.travelers]);
    try {
      const cached = dependencies.cache.peek(key);
      const places = await (cached ??
        dependencies.cache.remember(key, async () => {
          // 같은 열쇠의 동시 요청은 한 번만 예약하고 한 번만 유료 서비스를 부른다.
          const decision = await dependencies.guard.admit(identity);
          if (!decision.allowed) throw new CostLimitError(decision);
          return recommendPlaces(
            trip,
            dependencies.createProvider(placesKey),
            dependencies.createJudge(typesafeKey),
          );
        }));
      response.status(200).json({
        places,
        fetchedAt: dependencies.clock.now().toISOString(),
      });
    } catch (error) {
      if (error instanceof CostLimitError) {
        sendLimited(response, error.decision);
        return;
      }
      const timedOut =
        error instanceof APITimeoutError ||
        (error instanceof PlacesServiceError &&
          error.code === "UPSTREAM_TIMEOUT");
      sendJson(
        response,
        timedOut ? 504 : 502,
        timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROVIDER_ERROR",
      );
    }
  };
}

function parseBody(body: unknown): RecommendTrip | null {
  if (
    !hasOnlyKeys(
      body,
      ["destination", "preference", "startDate", "endDate", "travelers"],
      ["destination", "startDate", "endDate", "travelers"],
    ) ||
    typeof body.destination !== "string" ||
    (body.preference !== undefined && typeof body.preference !== "string") ||
    typeof body.startDate !== "string" ||
    typeof body.endDate !== "string" ||
    !DATE_PATTERN.test(body.startDate) ||
    !DATE_PATTERN.test(body.endDate) ||
    body.endDate < body.startDate ||
    typeof body.travelers !== "number" ||
    !Number.isInteger(body.travelers) ||
    body.travelers < 1 ||
    body.travelers > MAX_TRAVELERS
  ) {
    return null;
  }
  const destination = body.destination.trim();
  const preference = (body.preference ?? "").trim();
  if (
    destination.length === 0 ||
    destination.length > MAX_DESTINATION_LENGTH ||
    preference.length > MAX_PREFERENCE_LENGTH
  ) {
    return null;
  }
  return {
    destination,
    preference,
    startDate: body.startDate,
    endDate: body.endDate,
    travelers: body.travelers,
  };
}

export default createRecommendPlacesHandler({
  clock: { now: () => new Date() },
  env: process.env,
  createProvider: (apiKey) => createGooglePlacesClient({ apiKey }),
  createJudge: createTypeSafePlaceJudge,
  lookupMember: createSupabaseMemberLookup(process.env),
  guard: createDefaultRouteGuard("RECOMMEND_PLACES", process.env),
  cache: createResponseCache({ ttlMs: RECOMMEND_TTL_MS, maxEntries: 200, disabled: isCacheOff(process.env) }),
});
