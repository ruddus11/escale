import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";
import type { PlaceSummary } from "../../src/domain/places/types";
import { PlacesServiceError } from "./googlePlacesClient";
import { createPlacesSearchHandler } from "../../api/places-search";

const STRONG_TOKEN = "s".repeat(24);
const NOW = new Date("2026-07-20T03:00:00.000Z");
const VALID_ENV = {
  TRANSIT_ACCESS_TOKEN: STRONG_TOKEN,
  GOOGLE_MAPS_API_KEY: "places-key",
};
const PLACES: PlaceSummary[] = [
  {
    placeId: "ChIJ123",
    displayName: "우메다 스카이빌딩",
    formattedAddress: "오사카시 기타구",
    location: { latitude: 34.7055, longitude: 135.4903 },
    googleMapsUri: "https://maps.google.com/?cid=1",
  },
];

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

function createHandler(overrides?: {
  env?: Record<string, string | undefined>;
  searchText?: () => Promise<PlaceSummary[]>;
  now?: Date;
}) {
  return createPlacesSearchHandler({
    clock: { now: () => overrides?.now ?? NOW },
    env: overrides?.env ?? VALID_ENV,
    guard: { admit: async () => ({ allowed: true }) },
    createProvider: () => ({
      searchText: overrides?.searchText ?? (() => Promise.resolve(PLACES)),
      searchNearbyRestaurants: () => Promise.resolve([]),
    }),
  });
}

describe("places search handler", () => {
  it("returns places for a valid query", async () => {
    const capture = createCapture();
    await createHandler()(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { query: "우메다 스카이빌딩" },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(200);
    expect(capture.body).toMatchObject({
      places: PLACES,
      fetchedAt: NOW.toISOString(),
    });
  });

  it("rejects a missing token with 401", async () => {
    const capture = createCapture();
    await createHandler()(
      createRequest({ body: { query: "우메다" } }),
      capture.response,
    );
    expect(capture.statusCode).toBe(401);
    expect(capture.body).toEqual({ code: "UNAUTHORIZED" });
  });

  it("returns 503 when the google key is missing", async () => {
    const capture = createCapture();
    await createHandler({
      env: { TRANSIT_ACCESS_TOKEN: STRONG_TOKEN },
    })(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { query: "우메다" },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(503);
    expect(capture.body).toEqual({ code: "SERVER_CONFIG_ERROR" });
  });

  it("rejects invalid bodies with 400", async () => {
    for (const body of [
      undefined,
      {},
      { query: "" },
      { query: "a".repeat(81) },
      { query: "우메다", extra: 1 },
      { query: "우메다", center: { latitude: 1 } },
    ]) {
      const capture = createCapture();
      await createHandler()(
        createRequest({ authorization: `Bearer ${STRONG_TOKEN}`, body }),
        capture.response,
      );
      expect(capture.statusCode).toBe(400);
    }
  });

  it("rejects invalid world coordinates with 403", async () => {
    const capture = createCapture();
    await createHandler()(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: {
          query: "우메다",
          center: { latitude: 91, longitude: 139.76 },
        },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(403);
    expect(capture.body).toEqual({ code: "OUTSIDE_REGION" });
  });

  it("accepts requests after the old trip window", async () => {
    const capture = createCapture();
    await createHandler({ now: new Date("2026-08-01T00:00:00.000Z") })(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { query: "우메다" },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(200);
  });

  it("maps provider errors to honest upstream codes", async () => {
    const capture = createCapture();
    await createHandler({
      searchText: () =>
        Promise.reject(new PlacesServiceError("UPSTREAM_TIMEOUT")),
    })(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { query: "우메다" },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(504);
    expect(capture.body).toEqual({ code: "UPSTREAM_TIMEOUT" });
  });

  it("maps an unexpected provider throw to 502", async () => {
    const capture = createCapture();
    await createHandler({
      searchText: () => Promise.reject(new Error("boom")),
    })(
      createRequest({
        authorization: `Bearer ${STRONG_TOKEN}`,
        body: { query: "우메다" },
      }),
      capture.response,
    );
    expect(capture.statusCode).toBe(502);
    expect(capture.body).toEqual({ code: "UPSTREAM_PROVIDER_ERROR" });
  });

  it("rejects non-POST methods with 405", async () => {
    const capture = createCapture();
    await createHandler()(
      createRequest({ method: "GET" }),
      capture.response,
    );
    expect(capture.statusCode).toBe(405);
  });
});
