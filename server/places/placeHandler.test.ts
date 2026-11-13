import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";
import { createPlaceHandler, type PlaceAnswer } from "../../api/place";
import { createMemoryCounterStore, createRouteGuard, type RouteGuard } from "../security/costGuard";
import { createResponseCache, type ResponseCache } from "../security/responseCache";
import { PlacesServiceError } from "./googlePlacesClient";
import { createGooglePlaceLookup, type PlaceLookup } from "./googlePlaceLookup";

const STRONG_TOKEN = "s".repeat(24);
const ENV = { TRANSIT_ACCESS_TOKEN: STRONG_TOKEN, GOOGLE_MAPS_API_KEY: "places-key" };
const PLACE_ID = "ChIJ0000000000";
const SESSION = "0f8fad5b-d9cb-469f-a165-70867728950e";
const LOCATION = { placeId: PLACE_ID, latitude: 38.7098, longitude: -9.1335, address: "Largo da Sé, Lisboa" };

const ALLOW: RouteGuard = { admit: async () => ({ allowed: true }) };

function capture() {
  const result: { status?: number; body?: unknown; headers?: Record<string, string> } = {};
  const response = {
    setHeader: (name: string, value: string) => ((result.headers = { ...result.headers, [name]: value }), response),
    status: (code: number) => ((result.status = code), response),
    json: (body: unknown) => ((result.body = body), response),
  } as unknown as VercelResponse;
  return { result, response };
}

function request(body: unknown, authorization: string | undefined, ip = "203.0.113.7") {
  return { method: "POST", headers: { authorization, "x-forwarded-for": ip }, body } as unknown as VercelRequest;
}

function lookup(overrides: Partial<PlaceLookup> = {}): PlaceLookup {
  return {
    suggest: async () => [{ placeId: PLACE_ID, name: "Lisbon Cathedral", detail: "Largo da Sé, Lisboa" }],
    locate: async () => LOCATION,
    find: async () => PLACE_ID,
    ...overrides,
  };
}

async function call(body: unknown, options: { allowGuests?: boolean; authorization?: string; lookupUser?: (token: string) => Promise<string | null>; place?: PlaceLookup; env?: Record<string, string | undefined>; guard?: RouteGuard; cache?: ResponseCache<PlaceAnswer>; ip?: string; headers?: Record<string, string> } = {}) {
  const handler = createPlaceHandler({
    env: options.env ?? ENV,
    allowGuests: options.allowGuests,
    createLookup: () => options.place ?? lookup(),
    lookupUser: options.lookupUser ?? null,
    guard: options.guard ?? ALLOW,
    cache: options.cache ?? createResponseCache({ ttlMs: 0 }),
  });
  const { result, response } = capture();
  await handler(request(body, "authorization" in options ? options.authorization : `Bearer ${STRONG_TOKEN}`, options.ip), response);
  const { headers, ...rest } = result;
  if (options.headers) Object.assign(options.headers, headers);
  return rest;
}

describe("place cost protection", () => {
  function counting() {
    const seen = { suggest: 0, locate: 0, find: 0, near: [] as unknown[] };
    const place = lookup({
      suggest: async (input) => (seen.suggest++, seen.near.push(input.near), [{ placeId: PLACE_ID, name: "Lisbon Cathedral", detail: "Lisboa" }]),
      locate: async () => (seen.locate++, LOCATION),
      find: async () => (seen.find++, PLACE_ID),
    });
    return { seen, place };
  }
  const clock = () => ({ at: 0, now() { return this.at; } });

  it("returns 429 with Retry-After once a person passes the per-minute limit", async () => {
    const guard = createRouteGuard({ route: "PLACE", perMinute: 2, perDay: 100, globalPerDay: 100 }, createMemoryCounterStore(), { now: () => 30_000 });
    const lookupUser = async () => "user-1";
    const headers: Record<string, string> = {};
    const send = (text: string) => call({ action: "find", text, language: "en" }, { guard, lookupUser, authorization: "Bearer login", headers });
    expect((await send("a")).status).toBe(200);
    expect((await send("b")).status).toBe(200);
    expect(await send("c")).toEqual({ status: 429, body: { code: "RATE_LIMITED", retryAfter: 30, message: expect.any(String) } });
    expect(headers["Retry-After"]).toBe("30");
  });

  it("limits personal-code callers by IP", async () => {
    const guard = createRouteGuard({ route: "PLACE", perMinute: 1, perDay: 100, globalPerDay: 100 }, createMemoryCounterStore(), { now: () => 0 });
    expect((await call({ action: "find", text: "a", language: "en" }, { guard, ip: "198.51.100.1" })).status).toBe(200);
    expect((await call({ action: "find", text: "b", language: "en" }, { guard, ip: "198.51.100.1" })).status).toBe(429);
    expect((await call({ action: "find", text: "c", language: "en" }, { guard, ip: "198.51.100.2" })).status).toBe(200);
  });

  it("serves identical lookups from memory without calling Google or using quota", async () => {
    const { seen, place } = counting();
    const cache = createResponseCache<PlaceAnswer>({ ttlMs: 60_000, clock: clock() });
    const guard = createRouteGuard({ route: "PLACE", perMinute: 1, perDay: 100, globalPerDay: 100 }, createMemoryCounterStore(), { now: () => 0 });
    const first = await call({ action: "find", text: "Largo da Sé", language: "ko" }, { place, cache, guard });
    const again = await call({ action: "find", text: "  largo  da sé ", language: "ko" }, { place, cache, guard });
    expect(again).toEqual(first);
    expect(seen).toMatchObject({ find: 1, locate: 1 });
    // 언어가 다르면 다른 요청이다. 이미 분당 한도를 썼으므로 429가 된다.
    expect((await call({ action: "find", text: "Largo da Sé", language: "en" }, { place, cache, guard })).status).toBe(429);
  });

  it("counts simultaneous identical lookups once before the paid call", async () => {
    const { seen, place } = counting();
    const cache = createResponseCache<PlaceAnswer>({ ttlMs: 60_000, clock: clock() });
    const guard = createRouteGuard({ route: "PLACE", perMinute: 1, perDay: 1, globalPerDay: 1 }, createMemoryCounterStore(), { now: () => 0 });
    const body = { action: "find", text: "Lisbon", language: "en" };
    const results = await Promise.all([call(body, { place, cache, guard }), call(body, { place, cache, guard })]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(seen).toMatchObject({ find: 1, locate: 1 });
    expect((await call({ ...body, text: "Porto" }, { place, cache, guard })).body).toMatchObject({ code: "DAILY_LIMIT_REACHED" });
  });

  it("shares suggestions across session tokens and nearby starting points", async () => {
    const { seen, place } = counting();
    const cache = createResponseCache<PlaceAnswer>({ ttlMs: 60_000, clock: clock() });
    await call({ action: "suggest", text: "lisbon", sessionToken: SESSION, language: "en", near: { latitude: 38.71234, longitude: -9.13987 } }, { place, cache });
    await call({ action: "suggest", text: "Lisbon", sessionToken: "another-session-1", language: "en", near: { latitude: 38.7149, longitude: -9.1401 } }, { place, cache });
    expect(seen.suggest).toBe(1);
    expect(seen.near[0]).toEqual({ latitude: 38.71, longitude: -9.14 });
  });

  it("always asks Google for the location that closes an autocomplete session", async () => {
    const { seen, place } = counting();
    const cache = createResponseCache<PlaceAnswer>({ ttlMs: 60_000, clock: clock() });
    await call({ action: "locate", placeId: PLACE_ID, language: "ko" }, { place, cache });
    await call({ action: "locate", placeId: PLACE_ID, language: "ko" }, { place, cache });
    expect(seen.locate).toBe(1);
    await call({ action: "locate", placeId: PLACE_ID, sessionToken: SESSION, language: "ko" }, { place, cache });
    expect(seen.locate).toBe(2);
  });

  it("does not cache Google failures", async () => {
    let fail = true;
    const place = lookup({ find: async () => { if (fail) throw new PlacesServiceError("UPSTREAM_PROVIDER_ERROR"); return PLACE_ID; } });
    const cache = createResponseCache<PlaceAnswer>({ ttlMs: 60_000, clock: clock() });
    expect((await call({ action: "find", text: "Porto", language: "en" }, { place, cache })).status).toBe(502);
    fail = false;
    expect((await call({ action: "find", text: "Porto", language: "en" }, { place, cache })).status).toBe(200);
  });
});

describe("place handler", () => {
  it("suggests places while typing", async () => {
    expect(await call({ action: "suggest", text: "lisbon cath", sessionToken: SESSION, language: "en" })).toEqual({
      status: 200,
      body: { suggestions: [{ placeId: PLACE_ID, name: "Lisbon Cathedral", detail: "Largo da Sé, Lisboa" }] },
    });
  });

  it("returns the picked place's location", async () => {
    expect(await call({ action: "locate", placeId: PLACE_ID, sessionToken: SESSION, language: "ko" })).toEqual({ status: 200, body: { place: LOCATION } });
  });

  it("finds a typed address, or nothing", async () => {
    expect(await call({ action: "find", text: "Largo da Sé, Lisboa", language: "ko" })).toEqual({ status: 200, body: { place: LOCATION } });
    expect(await call({ action: "find", text: "nowhere at all", language: "ko" }, { place: lookup({ find: async () => null }) })).toEqual({ status: 200, body: { place: null } });
  });

  it("lets any signed-in person in, without a paid plan", async () => {
    const lookupUser = async (token: string) => (token === "login-token" ? "user-1" : null);
    expect((await call({ action: "find", text: "Porto", language: "en" }, { authorization: "Bearer login-token", lookupUser })).status).toBe(200);
    expect((await call({ action: "find", text: "Porto", language: "en" }, { authorization: "Bearer wrong", lookupUser })).status).toBe(401);
    expect((await call({ action: "find", text: "Porto", language: "en" }, { authorization: undefined, lookupUser })).status).toBe(401);
  });

  it("rejects malformed requests", async () => {
    const bad = [
      { action: "suggest", text: "x", language: "en" },
      { action: "suggest", text: "", sessionToken: SESSION, language: "en" },
      { action: "suggest", text: "x".repeat(121), sessionToken: SESSION, language: "en" },
      { action: "locate", placeId: "../../etc", language: "en" },
      { action: "find", text: "Porto", language: "fr" },
      { action: "find", text: "Porto", language: "en", extra: true },
      { action: "delete", text: "Porto", language: "en" },
    ];
    for (const body of bad) expect((await call(body)).status, JSON.stringify(body)).toBe(400);
  });

  it("reports Google failures without details", async () => {
    const slow = lookup({ suggest: async () => Promise.reject(new PlacesServiceError("UPSTREAM_TIMEOUT")) });
    expect(await call({ action: "suggest", text: "x", sessionToken: SESSION, language: "en" }, { place: slow })).toEqual({ status: 504, body: { code: "UPSTREAM_TIMEOUT" } });
    expect((await call({ action: "find", text: "Porto", language: "en" }, { env: { TRANSIT_ACCESS_TOKEN: STRONG_TOKEN } })).status).toBe(503);
  });
});

describe("Google place lookup", () => {
  function fakeFetch(payload: unknown, seen: { url?: string; init?: RequestInit } = {}) {
    return (async (url: string, init: RequestInit) => {
      seen.url = url;
      seen.init = init;
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as unknown as typeof fetch;
  }

  it("keeps only place predictions with a name", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const places = createGooglePlaceLookup({
      apiKey: "k",
      fetch: fakeFetch(
        {
          suggestions: [
            { placePrediction: { placeId: PLACE_ID, structuredFormat: { mainText: { text: "Lisbon Cathedral" }, secondaryText: { text: "Lisboa" } } } },
            { queryPrediction: { text: { text: "lisbon cathedral tickets" } } },
            { placePrediction: { placeId: "bad id", structuredFormat: { mainText: { text: "Broken" } } } },
          ],
        },
        seen,
      ),
    });
    expect(await places.suggest({ text: "lisbon", sessionToken: SESSION, language: "en" })).toEqual([{ placeId: PLACE_ID, name: "Lisbon Cathedral", detail: "Lisboa" }]);
    expect(JSON.parse(String(seen.init?.body))).toEqual({ input: "lisbon", sessionToken: SESSION, languageCode: "en" });
  });

  it("reads the location of a place and asks only for cheap fields", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const places = createGooglePlaceLookup({ apiKey: "k", fetch: fakeFetch({ id: PLACE_ID, location: { latitude: 38.7, longitude: -9.1 }, formattedAddress: "Lisboa" }, seen) });
    expect(await places.locate({ placeId: PLACE_ID, language: "ko" })).toEqual({ placeId: PLACE_ID, latitude: 38.7, longitude: -9.1, address: "Lisboa" });
    expect((seen.init?.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe("id,location,formattedAddress");
    const broken = createGooglePlaceLookup({ apiKey: "k", fetch: fakeFetch({ id: PLACE_ID }) });
    await expect(broken.locate({ placeId: PLACE_ID, language: "ko" })).rejects.toBeInstanceOf(PlacesServiceError);
  });
});


describe("guest place access", () => {
  const body = { action: "find", text: "Osaka", language: "ko" };
  it("allows a guest only through explicitly enabled guest handling", async () => {
    expect((await call(body, { authorization: undefined })).status).not.toBe(200);
    expect((await call(body, { authorization: undefined, allowGuests: true })).status).toBe(200);
  });
  it("limits guests by IP even when a response is cached", async () => {
    const guard = createRouteGuard({ route: "GUEST_PLACE", perMinute: 1, perDay: 2, globalPerDay: 3 }, createMemoryCounterStore(), { now: () => 30_000 });
    const cache = createResponseCache<PlaceAnswer>({ ttlMs: 60_000 });
    const options = { authorization: undefined, allowGuests: true, guard, cache };
    expect((await call(body, options)).status).toBe(200);
    expect((await call(body, options)).status).toBe(429);
    expect((await call(body, { ...options, ip: "203.0.113.8" })).status).toBe(200);
  });
});
