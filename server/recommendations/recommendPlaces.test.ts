import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";
import type { PlaceSummary } from "../../src/domain/places/types";
import { createRecommendPlacesHandler } from "../../api/recommend-places";
import { PlacesServiceError } from "../places/googlePlacesClient";
import { createMemoryCounterStore, createRouteGuard, type RouteGuard } from "../security/costGuard";
import { createResponseCache, type ResponseCache } from "../security/responseCache";
import {
  recommendPlaces,
  type PlaceRecommendation,
  type PlaceJudge,
  type PlaceJudgement,
  type RecommendTrip,
} from "./recommendPlaces";

const TRIP: RecommendTrip = {
  destination: "오사카",
  preference: "조용한 카페",
  startDate: "2026-11-01",
  endDate: "2026-11-04",
  travelers: 2,
};

function place(id: string): PlaceSummary {
  return {
    placeId: id,
    displayName: `장소 ${id}`,
    formattedAddress: "오사카시",
    location: { latitude: 34.7, longitude: 135.5 },
    googleMapsUri: `https://maps.google.com/?cid=${id}`,
  };
}

// 검색어의 분류명(맛집/카페/관광지/쇼핑)마다 돌려줄 장소를 지정한다.
function placesBy(byLabel: Record<string, PlaceSummary[]>) {
  return {
    queries: [] as string[],
    async searchText({ query }: { query: string }) {
      this.queries.push(query);
      return byLabel[query.split(" ").pop()!] ?? [];
    },
  };
}

function judgeBy(
  byId: Record<string, PlaceJudgement | Error>,
): PlaceJudge & { calls: string[] } {
  return {
    calls: [],
    async judge(_trip, p) {
      this.calls.push(p.placeId);
      const result = byId[p.placeId] ?? { inDestination: 1, preferenceFit: 0 };
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("recommendPlaces", () => {
  it("searches each category with the trip destination", async () => {
    const places = placesBy({});
    await recommendPlaces(TRIP, places, judgeBy({}));
    expect(places.queries).toEqual([
      "오사카 맛집",
      "오사카 카페",
      "오사카 관광지",
      "오사카 쇼핑",
    ]);
  });

  it("ranks by preference fit, drops places outside the destination and keeps three per category", async () => {
    const result = await recommendPlaces(
      TRIP,
      placesBy({ 카페: ["a", "b", "c", "d", "e"].map(place) }),
      judgeBy({
        a: { inDestination: 0.9, preferenceFit: 0.2 },
        b: { inDestination: 0.2, preferenceFit: 1 },
        c: { inDestination: 0.9, preferenceFit: 0.9 },
        d: { inDestination: 0.9, preferenceFit: 0.5 },
        e: { inDestination: 0.9, preferenceFit: 0.1 },
      }),
    );
    expect(result.map((r) => [r.placeId, r.category])).toEqual([
      ["c", "cafe"],
      ["d", "cafe"],
      ["a", "cafe"],
    ]);
  });

  it("keeps search order when there is no preference", async () => {
    const result = await recommendPlaces(
      { ...TRIP, preference: "" },
      placesBy({ 맛집: ["x", "y"].map(place) }),
      judgeBy({
        x: { inDestination: 0.8, preferenceFit: null },
        y: { inDestination: 0.8, preferenceFit: null },
      }),
    );
    expect(result.map((r) => r.placeId)).toEqual(["x", "y"]);
  });

  it("judges a place found by several searches only once", async () => {
    const judge = judgeBy({});
    const result = await recommendPlaces(
      TRIP,
      placesBy({ 카페: [place("same")], 관광지: [place("same")] }),
      judge,
    );
    expect(judge.calls).toEqual(["same"]);
    expect(result.map((r) => r.category)).toEqual(["cafe"]);
  });

  it("skips a place whose judgement failed but fails when every judgement failed", async () => {
    const partial = await recommendPlaces(
      TRIP,
      placesBy({ 맛집: ["ok", "bad"].map(place) }),
      judgeBy({ bad: new Error("rate limited") }),
    );
    expect(partial.map((r) => r.placeId)).toEqual(["ok"]);

    await expect(
      recommendPlaces(
        TRIP,
        placesBy({ 맛집: [place("bad")] }),
        judgeBy({ bad: new Error("down") }),
      ),
    ).rejects.toThrow("down");
  });
});

const TOKEN = "s".repeat(24);
const ENV = {
  TRANSIT_ACCESS_TOKEN: TOKEN,
  GOOGLE_MAPS_API_KEY: "places-key",
  TYPESAFE_API_KEY: "typesafe-key",
};
const BODY = {
  destination: "오사카",
  preference: "조용한 카페",
  startDate: "2026-11-01",
  endDate: "2026-11-04",
  travelers: 2,
};

async function call(overrides: {
  env?: Record<string, string | undefined>;
  body?: unknown;
  authorization?: string;
  searchText?: () => Promise<PlaceSummary[]>;
  guard?: RouteGuard;
  cache?: ResponseCache<PlaceRecommendation[]>;
  headers?: Record<string, string>;
  ip?: string;
}) {
  const capture: { status?: number; body?: unknown } = {};
  const response = {
    setHeader: (name: string, value: string) => (overrides.headers && (overrides.headers[name] = value), response),
    status: (code: number) => ((capture.status = code), response),
    json: (body: unknown) => ((capture.body = body), response),
  } as unknown as VercelResponse;
  const handler = createRecommendPlacesHandler({
    clock: { now: () => new Date("2026-10-11T00:00:00.000Z") },
    env: overrides.env ?? ENV,
    createProvider: () => ({
      searchText: overrides.searchText ?? (async () => [place("p")]),
      searchNearbyRestaurants: async () => [],
    }),
    createJudge: () => judgeBy({}),
    guard: overrides.guard ?? { admit: async () => ({ allowed: true }) },
    cache: overrides.cache ?? createResponseCache({ ttlMs: 0 }),
  });
  await handler(
    {
      method: "POST",
      headers: { authorization: overrides.authorization ?? `Bearer ${TOKEN}`, "x-forwarded-for": overrides.ip ?? "203.0.113.7" },
      body: "body" in overrides ? overrides.body : BODY,
    } as unknown as VercelRequest,
    response,
  );
  return capture;
}

describe("recommend-places handler", () => {
  it("returns recommendations for a valid trip", async () => {
    const result = await call({});
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      places: [{ placeId: "p", category: "food" }],
      fetchedAt: "2026-10-11T00:00:00.000Z",
    });
  });

  it("rejects requests without the access code", async () => {
    expect((await call({ authorization: "Bearer wrong" })).status).toBe(401);
  });

  it("reports missing server keys", async () => {
    const result = await call({ env: { ...ENV, TYPESAFE_API_KEY: " " } });
    expect(result).toEqual({ status: 503, body: { code: "SERVER_CONFIG_ERROR" } });
  });

  it.each([
    { ...BODY, destination: " " },
    { ...BODY, travelers: 0 },
    { ...BODY, endDate: "2026-10-31" },
    { ...BODY, preference: "가".repeat(121) },
    { ...BODY, extra: true },
  ])("rejects an invalid body %#", async (body) => {
    expect((await call({ body })).status).toBe(400);
  });

  it("maps upstream timeouts to 504", async () => {
    const result = await call({
      searchText: async () => {
        throw new PlacesServiceError("UPSTREAM_TIMEOUT");
      },
    });
    expect(result).toEqual({ status: 504, body: { code: "UPSTREAM_TIMEOUT" } });
  });
});

describe("recommend-places cost protection", () => {
  const strictGuard = (policy: { perMinute?: number; perDay?: number; globalPerDay?: number } = {}) =>
    createRouteGuard({ route: "RECOMMEND_PLACES", perMinute: 1, perDay: 20, globalPerDay: 300, ...policy }, createMemoryCounterStore(), { now: () => 45_000 });

  it("returns 429 with Retry-After before calling Google or Jev again", async () => {
    let searches = 0;
    const guard = strictGuard();
    const headers: Record<string, string> = {};
    const searchText = async () => (searches++, [place("p")]);
    expect((await call({ guard, searchText })).status).toBe(200);
    const blocked = await call({ guard, searchText, body: { ...BODY, preference: "다른 취향" }, headers });
    expect(blocked).toEqual({ status: 429, body: { code: "RATE_LIMITED", retryAfter: 15, message: expect.any(String) } });
    expect(headers["Retry-After"]).toBe("15");
    expect(searches).toBe(4);
  });

  it("closes the route for everyone at the global daily cap", async () => {
    const guard = createRouteGuard({ route: "RECOMMEND_PLACES", perMinute: 9, perDay: 9, globalPerDay: 1 }, createMemoryCounterStore(), { now: () => 0 });
    expect((await call({ guard })).status).toBe(200);
    expect((await call({ guard, body: { ...BODY, travelers: 3 } })).body).toMatchObject({ code: "SERVICE_LIMIT_REACHED", retryAfter: 86_400 });
  });

  it("reuses the same trip's recommendations without new paid calls", async () => {
    let searches = 0;
    const searchText = async () => (searches++, [place("p")]);
    const cache = createResponseCache<PlaceRecommendation[]>({ ttlMs: 60_000, clock: { now: () => 0 } });
    const guard = strictGuard();
    const first = await call({ guard, cache, searchText });
    const again = await call({ guard, cache, searchText, body: { ...BODY, destination: "  오사카 " } });
    expect(again).toEqual(first);
    expect(searches).toBe(4);
  });

  it("counts simultaneous identical recommendations once and shares the cache without the caller's identity", async () => {
    let searches = 0;
    const searchText = async () => (searches++, [place("p")]);
    const cache = createResponseCache<PlaceRecommendation[]>({ ttlMs: 60_000, clock: { now: () => 0 } });
    const guard = strictGuard({ perMinute: 2, perDay: 2, globalPerDay: 2 });
    const first = await Promise.all([call({ guard, cache, searchText }), call({ guard, cache, searchText })]);
    expect(first.map((result) => result.status)).toEqual([200, 200]);
    expect(searches).toBe(4);
    // 열쇠에 계정·IP가 없으므로 다른 사람의 같은 조건은 기억한 결과로 답하고 한도를 쓰지 않는다.
    expect((await call({ guard, cache, searchText, ip: "203.0.113.8" })).status).toBe(200);
    expect(searches).toBe(4);
    expect((await call({ guard, cache, searchText, ip: "203.0.113.8", body: { ...BODY, travelers: 3 } })).status).toBe(200);
    expect(searches).toBe(8);
    expect((await call({ guard, cache, searchText, ip: "203.0.113.9", body: { ...BODY, travelers: 4 } })).body).toMatchObject({ code: "SERVICE_LIMIT_REACHED" });
  });
});
