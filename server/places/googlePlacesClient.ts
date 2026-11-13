import type {
  PlaceSummary,
  RestaurantCandidate,
} from "../../src/domain/places/types.js";
import type { Coordinates } from "../http/guards.js";

const SEARCH_TEXT_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchText";
const SEARCH_NEARBY_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchNearby";
const SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri";
const RESTAURANT_FIELD_MASK = `${SEARCH_FIELD_MASK},places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow`;
const REQUEST_TIMEOUT_MS = 8_000;
const TEXT_BIAS_RADIUS_METERS = 30_000;
const MAX_TEXT_RESULTS = 5;
const MAX_TEXT_RESULTS_LIMIT = 10;
const MAX_NEARBY_RESULTS = 10;

const priceLevelMap: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export type PlacesServiceErrorCode =
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_PROVIDER_ERROR"
  | "UPSTREAM_SCHEMA_ERROR";

export class PlacesServiceError extends Error {
  readonly code: PlacesServiceErrorCode;

  constructor(code: PlacesServiceErrorCode) {
    super(code);
    this.name = "PlacesServiceError";
    this.code = code;
  }
}

export interface SearchTextInput {
  query: string;
  center?: Coordinates;
  maxResults?: number;
}

export interface SearchNearbyInput {
  center: Coordinates;
  radiusMeters: number;
}

export interface GooglePlacesProvider {
  searchText(input: SearchTextInput): Promise<PlaceSummary[]>;
  searchNearbyRestaurants(
    input: SearchNearbyInput,
  ): Promise<RestaurantCandidate[]>;
}

interface GooglePlacesClientDependencies {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export function createGooglePlacesClient(
  dependencies: GooglePlacesClientDependencies,
): GooglePlacesProvider {
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;

  async function callGoogle(
    endpoint: string,
    fieldMask: string,
    body: Record<string, unknown>,
  ): Promise<unknown[]> {
    let response: Response;
    try {
      const requestInit: RequestInit & { cache: "no-store" } = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": dependencies.apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      };
      response = await fetchImpl(endpoint, requestInit);
    } catch (error) {
      throw new PlacesServiceError(
        isTimeoutError(error) ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROVIDER_ERROR",
      );
    }

    if (!response.ok) {
      throw new PlacesServiceError("UPSTREAM_PROVIDER_ERROR");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new PlacesServiceError(
        isTimeoutError(error) ? "UPSTREAM_TIMEOUT" : "UPSTREAM_SCHEMA_ERROR",
      );
    }

    if (!isRecord(payload)) {
      throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
    }
    if (payload.places === undefined) return [];
    if (!Array.isArray(payload.places)) {
      throw new PlacesServiceError("UPSTREAM_SCHEMA_ERROR");
    }
    return payload.places;
  }

  return {
    async searchText(input) {
      const maxResults = Math.min(
        input.maxResults ?? MAX_TEXT_RESULTS,
        MAX_TEXT_RESULTS_LIMIT,
      );
      const body: Record<string, unknown> = {
        textQuery: input.query,
        languageCode: "ko",
        pageSize: maxResults,
      };
      if (input.center !== undefined) {
        body.locationBias = {
          circle: {
            center: input.center,
            radius: TEXT_BIAS_RADIUS_METERS,
          },
        };
      }
      const rawPlaces = await callGoogle(
        SEARCH_TEXT_ENDPOINT,
        SEARCH_FIELD_MASK,
        body,
      );

      const places: PlaceSummary[] = [];
      for (const raw of rawPlaces) {
        const summary = normalizePlaceSummary(raw);
        if (summary !== null) places.push(summary);
        if (places.length === maxResults) break;
      }
      return places;
    },

    async searchNearbyRestaurants(input) {
      const rawPlaces = await callGoogle(
        SEARCH_NEARBY_ENDPOINT,
        RESTAURANT_FIELD_MASK,
        {
          languageCode: "ko",
            includedTypes: ["restaurant"],
          maxResultCount: MAX_NEARBY_RESULTS,
          rankPreference: "POPULARITY",
          locationRestriction: {
            circle: {
              center: input.center,
              radius: input.radiusMeters,
            },
          },
        },
      );

      const restaurants: RestaurantCandidate[] = [];
      for (const raw of rawPlaces) {
        const summary = normalizePlaceSummary(raw);
        if (summary === null || !isRecord(raw)) continue;
        restaurants.push({
          ...summary,
          ...(typeof raw.rating === "number" && Number.isFinite(raw.rating)
            ? { rating: raw.rating }
            : {}),
          ...(typeof raw.userRatingCount === "number" &&
          Number.isInteger(raw.userRatingCount)
            ? { userRatingCount: raw.userRatingCount }
            : {}),
          ...(typeof raw.priceLevel === "string" &&
          priceLevelMap[raw.priceLevel] !== undefined
            ? { priceLevel: priceLevelMap[raw.priceLevel] }
            : {}),
          ...(isRecord(raw.currentOpeningHours) &&
          typeof raw.currentOpeningHours.openNow === "boolean"
            ? { openNow: raw.currentOpeningHours.openNow }
            : {}),
          distanceMeters: haversineMeters(input.center, summary.location),
        });
      }
      return restaurants;
    },
  };
}

function normalizePlaceSummary(raw: unknown): PlaceSummary | null {
  if (!isRecord(raw)) return null;
  const displayName = isRecord(raw.displayName)
    ? raw.displayName.text
    : undefined;
  const location = raw.location;
  if (
    typeof raw.id !== "string" ||
    raw.id.length === 0 ||
    typeof displayName !== "string" ||
    displayName.length === 0 ||
    !isRecord(location) ||
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    typeof raw.googleMapsUri !== "string" ||
    !raw.googleMapsUri.startsWith("https://")
  ) {
    return null;
  }
  return {
    placeId: raw.id,
    displayName,
    formattedAddress:
      typeof raw.formattedAddress === "string" ? raw.formattedAddress : "",
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    googleMapsUri: raw.googleMapsUri,
  };
}

function haversineMeters(
  from: Coordinates,
  to: { latitude: number; longitude: number },
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(
    2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeoutError(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}
