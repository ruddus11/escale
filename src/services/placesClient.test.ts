import { afterEach, describe, expect, it, vi } from "vitest";
import { PlacesClientError, searchPlaces, usageLimitMessage } from "./placesClient";

const TOKEN = "t".repeat(24);

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(payload: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("searchPlaces", () => {
  it("posts the query with a bearer token and parses places", async () => {
    const fetchMock = stubFetch({
      places: [
        {
          placeId: "ChIJ123",
          displayName: "우메다 스카이빌딩",
          formattedAddress: "오사카시",
          location: { latitude: 34.7, longitude: 135.49 },
          googleMapsUri: "https://maps.google.com/?cid=1",
        },
      ],
      fetchedAt: "2026-07-20T03:00:00.000Z",
    });

    const result = await searchPlaces(
      { query: "우메다" },
      TOKEN,
      new AbortController().signal,
    );

    expect(result.places).toHaveLength(1);
    expect(result.places[0]?.placeId).toBe("ChIJ123");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/places-search");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("throws a typed error with the server code", async () => {
    stubFetch({ code: "OUTSIDE_TRIP_WINDOW" }, false, 403);
    await expect(
      searchPlaces({ query: "우메다" }, TOKEN, new AbortController().signal),
    ).rejects.toMatchObject({
      name: "PlacesClientError",
      code: "OUTSIDE_TRIP_WINDOW",
    });
  });

  it("keeps the server's 429 limit code and explains it in the traveler's language", async () => {
    stubFetch({ code: "DAILY_LIMIT_REACHED", retryAfter: 3600 }, false, 429);
    const error = await searchPlaces({ query: "Lisboa" }, TOKEN, new AbortController().signal).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429, code: "DAILY_LIMIT_REACHED" });
    expect(usageLimitMessage("RATE_LIMITED", ["ko-KR"])).toContain("잠시 후");
    expect(usageLimitMessage("DAILY_LIMIT_REACHED", ["fr-FR", "en-GB"])).toContain("today's limit");
    expect(usageLimitMessage("SERVICE_LIMIT_REACHED", ["ja"])).toContain("後で");
    expect(usageLimitMessage("RATE_LIMITED", ["de"])).toContain("잠시 후");
    expect(usageLimitMessage("UPSTREAM_TIMEOUT", ["en"])).toBeNull();
  });

  it("throws INVALID_RESPONSE for malformed success bodies", async () => {
    stubFetch({ places: [{ nope: true }], fetchedAt: "x" });
    await expect(
      searchPlaces({ query: "우메다" }, TOKEN, new AbortController().signal),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(new PlacesClientError(0, "NETWORK_ERROR").code).toBe(
      "NETWORK_ERROR",
    );
  });
});
