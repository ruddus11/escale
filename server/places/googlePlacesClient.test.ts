import { describe, expect, it, vi } from "vitest";
import {
  PlacesServiceError,
  createGooglePlacesClient,
} from "./googlePlacesClient";

const API_KEY = "places-api-key-must-not-leak";
const CENTER = { latitude: 34.7055, longitude: 135.4903 };

const googlePlace = {
  id: "ChIJ123",
  displayName: { text: "우메다 스카이빌딩", languageCode: "ko" },
  formattedAddress: "오사카시 기타구 오요도나카 1-1-88",
  location: { latitude: 34.7055, longitude: 135.4903 },
  types: ["tourist_attraction"],
  googleMapsUri: "https://maps.google.com/?cid=1",
};

const googleRestaurant = {
  ...googlePlace,
  id: "ChIJ456",
  displayName: { text: "네기야키 야마모토", languageCode: "ko" },
  rating: 4.4,
  userRatingCount: 1200,
  priceLevel: "PRICE_LEVEL_MODERATE",
  currentOpeningHours: { openNow: true },
};

function fetchReturning(payload: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response);
}

describe("searchText", () => {
  it("normalizes places and sends key/fieldmask headers only to Google", async () => {
    const fetchMock = fetchReturning({ places: [googlePlace] });
    const client = createGooglePlacesClient({ apiKey: API_KEY, fetch: fetchMock });

    const places = await client.searchText({ query: "우메다", center: CENTER });

    expect(places).toEqual([
      {
        placeId: "ChIJ123",
        displayName: "우메다 스카이빌딩",
        formattedAddress: "오사카시 기타구 오요도나카 1-1-88",
        location: { latitude: 34.7055, longitude: 135.4903 },
        googleMapsUri: "https://maps.google.com/?cid=1",
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe(API_KEY);
    expect(headers["X-Goog-FieldMask"]).toContain("places.googleMapsUri");
    expect(JSON.stringify(init.body)).not.toContain(API_KEY);
  });

  it("returns empty list when Google returns no places", async () => {
    const client = createGooglePlacesClient({
      apiKey: API_KEY,
      fetch: fetchReturning({}),
    });
    await expect(client.searchText({ query: "우메다" })).resolves.toEqual([]);
  });

  it("skips malformed entries instead of failing the whole search", async () => {
    const client = createGooglePlacesClient({
      apiKey: API_KEY,
      fetch: fetchReturning({ places: [{ id: "no-name" }, googlePlace] }),
    });
    const places = await client.searchText({ query: "우메다" });
    expect(places).toHaveLength(1);
    expect(places[0]?.placeId).toBe("ChIJ123");
  });

  it("maps provider failure to PlacesServiceError", async () => {
    const client = createGooglePlacesClient({
      apiKey: API_KEY,
      fetch: fetchReturning({}, false, 500),
    });
    await expect(client.searchText({ query: "우메다" })).rejects.toMatchObject({
      name: "PlacesServiceError",
      code: "UPSTREAM_PROVIDER_ERROR",
    });
    expect(new PlacesServiceError("UPSTREAM_TIMEOUT").code).toBe(
      "UPSTREAM_TIMEOUT",
    );
  });

  it("classifies an aborted fetch as UPSTREAM_TIMEOUT", async () => {
    const client = createGooglePlacesClient({
      apiKey: API_KEY,
      fetch: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })),
    });
    await expect(client.searchText({ query: "우메다" })).rejects.toMatchObject({
      code: "UPSTREAM_TIMEOUT",
    });
  });

  it("classifies a plain fetch rejection as UPSTREAM_PROVIDER_ERROR", async () => {
    const client = createGooglePlacesClient({
      apiKey: API_KEY,
      fetch: vi.fn().mockRejectedValue(new Error("socket hang up")),
    });
    await expect(client.searchText({ query: "우메다" })).rejects.toMatchObject({
      code: "UPSTREAM_PROVIDER_ERROR",
    });
  });
});

describe("searchNearbyRestaurants", () => {
  it("normalizes rating, price level, openNow, and distance", async () => {
    const client = createGooglePlacesClient({
      apiKey: API_KEY,
      fetch: fetchReturning({ places: [googleRestaurant] }),
    });
    const restaurants = await client.searchNearbyRestaurants({
      center: CENTER,
      radiusMeters: 800,
    });

    expect(restaurants).toHaveLength(1);
    expect(restaurants[0]).toMatchObject({
      placeId: "ChIJ456",
      rating: 4.4,
      userRatingCount: 1200,
      priceLevel: 2,
      openNow: true,
      distanceMeters: 0,
    });
  });
});
