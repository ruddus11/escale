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

const MAX_QUERY_LENGTH = 80;

interface HandlerClock {
  now(): Date;
}

interface PlacesSearchEnvironment {
  TRANSIT_ACCESS_TOKEN?: string;
  GOOGLE_MAPS_API_KEY?: string;
}

export interface PlacesSearchHandlerDependencies {
  clock: HandlerClock;
  env: PlacesSearchEnvironment;
  createProvider: (apiKey: string) => GooglePlacesProvider;
  guard: RouteGuard;
}

type ParsedBody =
  | { ok: true; query: string; center?: Coordinates }
  | { ok: false };

export function createPlacesSearchHandler(
  dependencies: PlacesSearchHandlerDependencies,
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

    if (parsed.center !== undefined && !isValidCoordinates(parsed.center)) {
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
      const places = await provider.searchText({
        query: parsed.query,
        ...(parsed.center === undefined ? {} : { center: parsed.center }),
      });
      response.status(200).json({ places, fetchedAt: now.toISOString() });
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
  if (!hasOnlyKeys(body, ["query", "center"], ["query"])) {
    return { ok: false };
  }
  if (typeof body.query !== "string") return { ok: false };
  const query = body.query.trim();
  if (query.length === 0 || query.length > MAX_QUERY_LENGTH) {
    return { ok: false };
  }
  if (body.center === undefined) return { ok: true, query };
  const center = readCoordinates(body.center);
  if (center === null) return { ok: false };
  return { ok: true, query, center };
}

export default createPlacesSearchHandler({
  clock: { now: () => new Date() },
  env: process.env,
  createProvider: (apiKey) => createGooglePlacesClient({ apiKey }),
  guard: createDefaultRouteGuard("PLACES_SEARCH", process.env),
});
