import type { Coordinates } from "../domain/trip/types";

const GOOGLE_MAPS_DIRECTIONS_URL = "https://www.google.com/maps/dir/";
const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/";

export type GoogleMapsTravelMode = "walking" | "transit";
export type GoogleMapsLocation = Coordinates | string;

interface GoogleMapsDirectionsRequest {
  origin: GoogleMapsLocation;
  destination: GoogleMapsLocation;
  travelMode: GoogleMapsTravelMode;
}

export function createGoogleMapsDirectionsUrl({
  origin,
  destination,
  travelMode,
}: GoogleMapsDirectionsRequest): string {
  const query = new URLSearchParams({
    api: "1",
    origin: normalizeLocation(origin, "origin"),
    destination: normalizeLocation(destination, "destination"),
    travelmode: travelMode,
  });

  return `${GOOGLE_MAPS_DIRECTIONS_URL}?${query.toString()}`;
}

export function createGoogleMapsTransitUrl(destination: Coordinates): string {
  return createGoogleMapsCurrentLocationDirectionsUrl(destination, "transit");
}

export function createGoogleMapsCurrentLocationDirectionsUrl(
  destination: GoogleMapsLocation,
  travelMode: GoogleMapsTravelMode,
): string {
  const normalizedDestination = normalizeLocation(destination, "destination");

  const query = new URLSearchParams({
    api: "1",
    destination: normalizedDestination,
    travelmode: travelMode,
  });

  return `${GOOGLE_MAPS_DIRECTIONS_URL}?${query.toString()}`;
}

export function createGoogleMapsSearchUrl(query: string): string {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    throw new TypeError("Google Maps search query cannot be empty");
  }

  const parameters = new URLSearchParams({ api: "1", query: normalizedQuery });
  return `${GOOGLE_MAPS_SEARCH_URL}?${parameters.toString()}`;
}

function normalizeLocation(
  location: GoogleMapsLocation,
  field: "origin" | "destination",
): string {
  if (typeof location === "string") {
    const normalized = location.trim();
    if (normalized.length === 0) {
      throw new TypeError(`Google Maps ${field} cannot be empty`);
    }
    return normalized;
  }

  if (
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    throw new TypeError(
      `Google Maps ${field} must contain finite coordinates`,
    );
  }
  return `${location.latitude},${location.longitude}`;
}
