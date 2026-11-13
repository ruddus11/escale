import { describe, expect, it } from "vitest";
import { cacheKey, findPlace, isFresh, locatePlace, newSessionToken, parseCachedPoint, PlaceError, placeLanguage, suggestPlaces } from "../src/data/places";

const NOW = new Date("2026-10-15T00:00:00.000Z");
const POINT = { placeId: "ChIJ0000000000", latitude: 38.7098, longitude: -9.1335, address: "Largo da Sé, Lisboa" };

function server(status: number, payload: unknown, seen: { body?: Record<string, unknown>; auth?: string } = {}) {
  return (async (_url: string, init: RequestInit) => {
    seen.body = JSON.parse(String(init.body));
    seen.auth = (init.headers as Record<string, string>).Authorization;
    return new Response(JSON.stringify(payload), { status });
  }) as unknown as typeof fetch;
}

const call = { baseUrl: "https://example.test/", credential: "login-token", lang: "en-GB" as const };

describe("cacheKey", () => {
  it("prefers the place ID and falls back to a tidy address", () => {
    expect(cacheKey({ placeId: "ChIJ0000000000", address: "x" })).toBe("id:ChIJ0000000000");
    expect(cacheKey({ address: "  Largo   da Sé, LISBOA " })).toBe("addr:largo da sé, lisboa");
    expect(cacheKey({ address: "   " })).toBeNull();
    expect(cacheKey({})).toBeNull();
  });
});

describe("isFresh", () => {
  it("keeps coordinates for less than 30 days, as Google allows", () => {
    expect(isFresh({ latitude: 1, longitude: 1, at: "2026-09-16T00:00:01.000Z" }, NOW)).toBe(true);
    expect(isFresh({ latitude: 1, longitude: 1, at: "2026-09-15T00:00:00.000Z" }, NOW)).toBe(false);
    expect(isFresh({ latitude: 1, longitude: 1, at: "not a date" }, NOW)).toBe(false);
  });
});

describe("parseCachedPoint", () => {
  it("reads only valid coordinates", () => {
    expect(parseCachedPoint(JSON.stringify({ latitude: 38.7, longitude: -9.1, at: NOW.toISOString(), placeId: "ChIJ0000000000" }))).toEqual({
      latitude: 38.7,
      longitude: -9.1,
      at: NOW.toISOString(),
      placeId: "ChIJ0000000000",
    });
    expect(parseCachedPoint(JSON.stringify({ latitude: 200, longitude: 0, at: NOW.toISOString() }))).toBeNull();
    expect(parseCachedPoint("{oops")).toBeNull();
    expect(parseCachedPoint(null)).toBeNull();
  });
});

describe("newSessionToken", () => {
  it("looks like a UUID the server accepts", () => {
    expect(newSessionToken()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("placeLanguage", () => {
  it("asks Google in the app language", () => {
    expect(placeLanguage("ko")).toBe("ko");
    expect(placeLanguage("en-US")).toBe("en");
    expect(placeLanguage("ja")).toBe("ja");
  });
});

describe("place requests", () => {
  it("sends the login token and the app language", async () => {
    const seen: { body?: Record<string, unknown>; auth?: string } = {};
    const found = await suggestPlaces({ ...call, text: " lisbon ", sessionToken: "0f8fad5b-d9cb-469f-a165-70867728950e", fetchImpl: server(200, { suggestions: [{ placeId: POINT.placeId, name: "Lisbon Cathedral", detail: "Lisboa" }, { bad: true }] }, seen) });
    expect(found).toEqual([{ placeId: POINT.placeId, name: "Lisbon Cathedral", detail: "Lisboa" }]);
    expect(seen.auth).toBe("Bearer login-token");
    expect(seen.body).toEqual({ action: "suggest", text: "lisbon", sessionToken: "0f8fad5b-d9cb-469f-a165-70867728950e", language: "en" });
  });

  it("returns a location, or nothing when the address isn't found", async () => {
    expect(await locatePlace({ ...call, placeId: POINT.placeId, fetchImpl: server(200, { place: POINT }) })).toEqual(POINT);
    expect(await findPlace({ ...call, text: "Largo da Sé", fetchImpl: server(200, { place: null }) })).toBeNull();
  });

  it("explains why it could not search", async () => {
    await expect(findPlace({ ...call, baseUrl: "", text: "x" })).rejects.toMatchObject({ key: "place.noServer" });
    await expect(findPlace({ ...call, text: "x", fetchImpl: server(401, {}) })).rejects.toMatchObject({ key: "place.signIn" });
    await expect(findPlace({ ...call, text: "x", fetchImpl: server(504, {}) })).rejects.toMatchObject({ key: "place.slow" });
    await expect(locatePlace({ ...call, placeId: POINT.placeId, fetchImpl: server(200, { place: { placeId: "x" } }) })).rejects.toBeInstanceOf(PlaceError);
  });
});


it("searches through the guest endpoint without sending an empty bearer token", async () => {
  let url = "";
  let headers: HeadersInit | undefined;
  const fetchImpl = (async (input: string, init: RequestInit) => {
    url = input;
    headers = init.headers;
    return new Response(JSON.stringify({ place: POINT }), { status: 200 });
  }) as typeof fetch;
  expect(await findPlace({ baseUrl: "https://api.example/", credential: "", lang: "ko", text: "Osaka", fetchImpl })).toEqual(POINT);
  expect(url).toBe("https://api.example/api/guest-place");
  expect(new Headers(headers).has("Authorization")).toBe(false);
});
