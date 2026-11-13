import type { VercelApiHandler } from "@vercel/node";
import { checkTransitAccess } from "../server/security/access.js";
import {
  hasOnlyKeys,
  isValidCoordinates,
  readCoordinates,
  sendJson,
  setSafeResponseHeaders,
  type Coordinates,
} from "../server/http/guards.js";
import {
  PlacesServiceError,
  createGooglePlacesClient,
  type GooglePlacesProvider,
} from "../server/places/googlePlacesClient.js";
import { clientIdentity, createDefaultRouteGuard, sendLimited, type RouteGuard } from "../server/security/costGuard.js";

const RADIUS_METERS: Record<string, number> = { near: 800, wide: 1500 };
const MAX_RESULTS = 3;

interface HandlerClock {
  now(): Date;
}

interface PlacesRestaurantsEnvironment {
  TRANSIT_ACCESS_TOKEN?: string;
  GOOGLE_MAPS_API_KEY?: string;
}

export interface PlacesRestaurantsHandlerDependencies {
  clock: HandlerClock;
  env: PlacesRestaurantsEnvironment;
  createProvider: (apiKey: string) => GooglePlacesProvider;
  guard: RouteGuard;
}

type ParsedBody =
  | { ok: true; center: Coordinates; radiusMeters: number }
  | { ok: false };

export function createPlacesRestaurantsHandler(
  dependencies: PlacesRestaurantsHandlerDependencies,
): VercelApiHandler {
  return async (request, response) => {
    setSafeResponseHeaders(response);

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, "METHOD_NOT_ALLOWED");
      return;
    }

    const access = checkTransitAccess(
      dependencies.env.TRANSIT_ACCESS_TOKEN,
      request.headers.authorization,
    );
    if (access.ok === false) {
      sendJson(
        response,
        access.reason === "SERVER_TOKEN_MISCONFIGURED" ? 503 : 401,
        access.reason === "SERVER_TOKEN_MISCONFIGURED"
          ? "SERVER_CONFIG_ERROR"
          : "UNAUTHORIZED",
      );
      return;
    }

    const apiKey = dependencies.env.GOOGLE_MAPS_API_KEY;
    if (apiKey === undefined || apiKey.trim().length === 0) {
      sendJson(response, 503, "SERVER_CONFIG_ERROR");
      return;
    }

    const parsed = parseBody(request.body);
    if (!parsed.ok) {
      sendJson(response, 400, "INVALID_REQUEST");
      return;
    }

    if (!isValidCoordinates(parsed.center)) {
      sendJson(response, 403, "OUTSIDE_REGION");
      return;
    }

    const decision = await dependencies.guard.admit(clientIdentity(null, request.headers));
    if (!decision.allowed) {
      sendLimited(response, decision);
      return;
    }
    const now = dependencies.clock.now();

    const provider = dependencies.createProvider(apiKey);
    try {
      const candidates = await provider.searchNearbyRestaurants({
        center: parsed.center,
        radiusMeters: parsed.radiusMeters,
      });
      const restaurants = candidates
        .filter((entry) => entry.openNow !== false)
        .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
        .slice(0, MAX_RESULTS);
      response.status(200).json({ restaurants, fetchedAt: now.toISOString() });
    } catch (error) {
      if (error instanceof PlacesServiceError) {
        sendJson(
          response,
          error.code === "UPSTREAM_TIMEOUT" ? 504 : 502,
          error.code,
        );
        return;
      }
      sendJson(response, 502, "UPSTREAM_PROVIDER_ERROR");
    }
  };
}

function parseBody(body: unknown): ParsedBody {
  if (!hasOnlyKeys(body, ["center", "radius"], ["center", "radius"])) {
    return { ok: false };
  }
  const center = readCoordinates(body.center);
  if (center === null) return { ok: false };
  if (typeof body.radius !== "string" || !Object.hasOwn(RADIUS_METERS, body.radius)) {
    return { ok: false };
  }
  const radiusMeters = RADIUS_METERS[body.radius];
  return { ok: true, center, radiusMeters };
}

export default createPlacesRestaurantsHandler({
  clock: { now: () => new Date() },
  env: process.env,
  createProvider: (apiKey) => createGooglePlacesClient({ apiKey }),
  guard: createDefaultRouteGuard("PLACES_RESTAURANTS", process.env),
});
