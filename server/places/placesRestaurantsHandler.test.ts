import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";
import type { RestaurantCandidate } from "../../src/domain/places/types";
import { PlacesServiceError } from "./googlePlacesClient";
import { createPlacesRestaurantsHandler } from "../../api/places-restaurants";

const STRONG_TOKEN = "s".repeat(24);
const NOW = new Date("2026-07-20T03:00:00.000Z");
const CENTER = { latitude: 34.7025, longitude: 135.496 };
const VALID_ENV = {
  TRANSIT_ACCESS_TOKEN: STRONG_TOKEN,
  GOOGLE_MAPS_API_KEY: "places-key",
};

function candidate(overrides: Partial<RestaurantCandidate>): RestaurantCandidate {
  return {
    placeId: "ChIJ456",
    displayName: "네기야키 야마모토",
    formattedAddress: "오사카시",
    location: CENTER,
    googleMapsUri: "https://maps.google.com/?cid=2",
    distanceMeters: 120,
    ...overrides,
  };
}

interface Capture {
  statusCode?: number;
  body?: unknown;
  response: VercelResponse;
}

function createCapture(): Capture {
  const capture: Capture = {} as Capture;
  const response = {
    setHeader: () => response,
    status: (code: number) => {
      capture.statusCode = code;
      return response;
    },
    json: (body: unknown) => {
      capture.body = body;
      return response;
    },
  } as unknown as VercelResponse;
  capture.response = response;
  return capture;
}

function createRequest(overrides: {
  method?: string;
  authorization?: string;
  body?: unknown;
}): VercelRequest {
  return {
    method: overrides.method ?? "POST",
    headers: { authorization: overrides.authorization },
    body: overrides.body,
  } as unknown as VercelRequest;
}

function createHandler(candidates: RestaurantCandidate[]) {
  return createPlacesRestaurantsHandler({
    clock: { now: () => NOW },
    env: VALID_ENV,
    guard: { admit: async () => ({ allowed: true }) },
    createProvider: () => ({
      searchText: () => Promise.resolve([]),
      searchNearbyRestaurants: () => Promise.resolve(candidates),
    }),
  });
}

describe("places restaurants handler", () => {
  it("filters closed restaurants and returns the top three by rating", async () => {
    const capture = createCapture();
    await createHandler([
      candidate({ placeId: "closed", openNow: false, rating: 4.9 }),
      candidate({ placeId: "low", rating: 3.9, openNow: true }),
      candidate({ placeId: "top", rating: 4.8, openNow: true }),
      candidate({ placeId: "mid", rating: 4.2, openNow: true }),
      candidate({ placeId: "unknown-hours", rating: 4.5 }),
    ])(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { center: CENTER, radius: "near" },
      }),
      capture.response,
    );

    expect(capture.statusCode).toBe(200);
    const body = capture.body as { restaurants: RestaurantCandidate[] };
    expect(body.restaurants.map((entry) => entry.placeId)).toEqual([
      "top",
      "unknown-hours",
      "mid",
    ]);
  });

  it("rejects an invalid radius with 400", async () => {
    const capture = createCapture();
    await createHandler([])(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { center: CENTER, radius: 5000 },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(400);
  });

  it("rejects a prototype-chain radius string with 400", async () => {
    for (const radius of ["constructor", "__proto__", "toString"]) {
      const capture = createCapture();
      await createHandler([])(
        createRequest({
          authorization: `Bearer ${STRONG_TOKEN}`,
          body: { center: CENTER, radius },
        }),
        capture.response,
      );
      expect(capture.statusCode).toBe(400);
      expect(capture.body).toEqual({ code: "INVALID_REQUEST" });
    }
  });

  it("maps a provider timeout to 504", async () => {
    const capture = createCapture();
    await createPlacesRestaurantsHandler({
      clock: { now: () => NOW },
      env: VALID_ENV,
      guard: { admit: async () => ({ allowed: true }) },
      createProvider: () => ({
        searchText: () => Promise.resolve([]),
        searchNearbyRestaurants: () =>
          Promise.reject(new PlacesServiceError("UPSTREAM_TIMEOUT")),
      }),
    })(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { center: CENTER, radius: "near" },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(504);
    expect(capture.body).toEqual({ code: "UPSTREAM_TIMEOUT" });
  });

  it("rejects invalid world coordinates with 403", async () => {
    const capture = createCapture();
    await createHandler([])(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: {
          center: { latitude: 91, longitude: 139.76 },
          radius: "near",
        },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(403);
  });

  it("returns an empty list as success, not an error", async () => {
    const capture = createCapture();
    await createHandler([])(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { center: CENTER, radius: "wide" },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(200);
    expect(capture.body).toMatchObject({ restaurants: [] });
  });
});
