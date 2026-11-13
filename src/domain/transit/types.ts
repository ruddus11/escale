interface RouteOptionBase {
  id: string;
  label: string;
  routeDepartureAt: string;
  routeArrivalAt: string;
  durationMinutes: number;
  fetchedAt: string;
}

export interface TransitRouteOption extends RouteOptionBase {
  kind: "transit";
  firstTransitDepartureAt: string;
  leaveCurrentLocationAt: string;
  accessWalkMinutes: number;
  transferCount: number;
  lines: Array<{
    shortName: string;
    headsign: string;
    vehicleType: string;
    departureStopName: string;
    arrivalStopName: string;
  }>;
}

export interface WalkingRouteOption extends RouteOptionBase {
  kind: "walk";
  walkingMinutes: number;
}

export type TransitOption = TransitRouteOption | WalkingRouteOption;

export type TransitCountdownStatus =
  | "comfortable"
  | "prepare"
  | "leave-now"
  | "missed";

export interface TransitCountdown {
  minutesUntilTrain: number;
  minutesUntilLeave: number;
  status: TransitCountdownStatus;
}
