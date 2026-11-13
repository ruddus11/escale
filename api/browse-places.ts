import type { VercelApiHandler } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { checkSignedInAccess, createSupabaseUserLookup, type PaidAccessEnvironment, type UserLookup } from "../server/security/paidAccess.js";
import { hasOnlyKeys, sendJson, setSafeResponseHeaders } from "../server/http/guards.js";
import { createPlaceBrowser, type PlaceBrowser } from "../server/places/browsePlaces.js";
import { PlacesServiceError } from "../server/places/googlePlacesClient.js";
import { isBrowseCategory, isBrowseNear, isPicksRequest, roundNear } from "../src/domain/places/browse.js";
import { createPlaceUsage, isAdminUser, type PlaceUsage, type UsageDecision } from "../server/security/placeUsage.js";

export function createBrowsePlacesHandler(dependencies: { env: PaidAccessEnvironment & { GOOGLE_MAPS_API_KEY?: string; ADMIN_USER_IDS?: string }; lookupUser?: UserLookup | null; createBrowser: (key: string) => PlaceBrowser; usage: PlaceUsage | null }): VercelApiHandler {
  return async (request, response) => {
    setSafeResponseHeaders(response);
    if (request.method !== "POST") { response.setHeader("Allow", "POST"); sendJson(response, 405, "METHOD_NOT_ALLOWED"); return; }
    const access = await checkSignedInAccess(dependencies.env, request.headers.authorization, dependencies.lookupUser ?? null);
    if (!access.ok) { sendJson(response, access.status, access.code); return; }
    // 개인 접근 코드는 계정 ID가 없으므로 운영자 판별·개인 한도를 우회하는 데 사용할 수 없다.
    if (!access.userId) { sendJson(response, 401, "UNAUTHORIZED"); return; }
    const body: unknown = request.body;
    // near는 숙소 근처로 찾을 때만 온다. 저장하지 않고 Google 검색 기준 위치로만 쓴다.
    // 추천 후보(picks)는 근처 검색만 하므로 near가 꼭 있어야 한다.
    if (!hasOnlyKeys(body, ["destination", "category", "language", "near"], ["destination", "category", "language"]) || typeof body.destination !== "string" || !body.destination.trim() || body.destination.trim().length > 120 || !(isBrowseCategory(body.category) || (isPicksRequest(body.category) && body.near !== undefined)) || typeof body.language !== "string" || !["ko", "en", "ja"].includes(body.language) || (body.near !== undefined && !isBrowseNear(body.near))) {
      sendJson(response, 400, "INVALID_REQUEST"); return;
    }
    const key = dependencies.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key) { sendJson(response, 503, "SERVER_CONFIG_ERROR"); return; }
    if (!dependencies.usage) { sendJson(response, 503, "SEARCH_USAGE_UNAVAILABLE"); return; }
    const requestId = randomUUID();
    let decision: UsageDecision;
    try {
      decision = await dependencies.usage.reserve(access.userId, isAdminUser(access.userId, dependencies.env.ADMIN_USER_IDS), requestId);
    } catch { sendJson(response, 503, "SEARCH_USAGE_UNAVAILABLE"); return; }
    if (!decision.allowed) {
      response.setHeader("Retry-After", String(decision.retryAfter));
      const status = decision.code === "SEARCH_PAUSED" || decision.code === "SEARCH_BUDGET_EXCEEDED" ? 503 : 429;
      response.status(status).json({ code: decision.code, retryAfter: decision.retryAfter }); return;
    }
    const finish = async (succeeded: boolean) => {
      try { await dependencies.usage!.finish(requestId, succeeded); }
      catch {
        // 예약은 차감 상태로 남긴다. 성공 결과를 버리거나 무제한 호출을 허용하지 않는다.
        console.error("PLACE_SEARCH_SETTLEMENT_FAILED", requestId);
      }
    };
    try {
      const places = await dependencies.createBrowser(key)({ destination: body.destination.trim(), category: body.category, language: body.language as "ko" | "en" | "ja", ...(isBrowseNear(body.near) ? { near: roundNear(body.near) } : {}) });
      await finish(true);
      const { allowed: _allowed, ...usage } = decision;
      response.status(200).json({ places, usage });
    } catch (error) {
      await finish(false);
      const timeout = error instanceof PlacesServiceError && error.code === "UPSTREAM_TIMEOUT";
      sendJson(response, timeout ? 504 : 502, timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROVIDER_ERROR");
    }
  };
}
export default createBrowsePlacesHandler({ env: process.env, lookupUser: createSupabaseUserLookup(process.env), createBrowser: key => createPlaceBrowser({ apiKey: key }), usage: createPlaceUsage(process.env) });
