export interface PlaceLocation {
  latitude: number;
  longitude: number;
}

export interface AttachedPlace {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: PlaceLocation;
  googleMapsUri: string;
  attachedAt: string;
}

export interface PlaceSummary {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: PlaceLocation;
  googleMapsUri: string;
}

export interface RestaurantCandidate extends PlaceSummary {
  rating?: number;
  userRatingCount?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  openNow?: boolean;
  distanceMeters: number;
}
