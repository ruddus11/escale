export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Activity {
  id: string;
  title: string;
  targetAt: string;
  placeName: string;
  liveTransitEnabled: boolean;
  destination: Coordinates;
  plannedOrigin: Coordinates;
  plannedRoute: {
    originLabel: string;
    destinationLabel: string;
    modeLabel: string;
    transferCount: number;
    leaveCurrentLocationAt: string;
    firstTransitDepartureAt: string;
  };
  staticRouteSteps: string[];
}

export interface TripPlan {
  timeZone: string;
  activities: Activity[];
}
