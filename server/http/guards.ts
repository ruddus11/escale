import type { VercelResponse } from "@vercel/node";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type GuardedErrorCode =
  | "SEARCH_USAGE_UNAVAILABLE"
  | "METHOD_NOT_ALLOWED"
  | "SERVER_CONFIG_ERROR"
  | "UNAUTHORIZED"
  | "PAYMENT_REQUIRED"
  | "INVALID_REQUEST"
  | "OUTSIDE_REGION"
  | "OUTSIDE_TRIP_WINDOW"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_PROVIDER_ERROR"
  | "UPSTREAM_SCHEMA_ERROR";

export function setSafeResponseHeaders(response: VercelResponse): void {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
}

export function sendJson(
  response: VercelResponse,
  status: number,
  code: GuardedErrorCode,
): void {
  response.status(status).json({ code });
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

export function hasOnlyKeys(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.every((key) => allowedKeys.includes(key)) &&
    requiredKeys.every((key) => Object.hasOwn(value, key))
  );
}

export function readCoordinates(value: unknown): Coordinates | null {
  if (
    !hasOnlyKeys(value, ["latitude", "longitude"], ["latitude", "longitude"]) ||
    typeof value.latitude !== "number" ||
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude)
  ) {
    return null;
  }
  return { latitude: value.latitude, longitude: value.longitude };
}

export function isValidCoordinates(point: Coordinates): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}
