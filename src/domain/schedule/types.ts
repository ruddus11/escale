import type { AttachedPlace } from "../places/types";

export type ScheduleActivityKind =
  | "flight"
  | "transport"
  | "accommodation"
  | "shopping"
  | "meal"
  | "sightseeing"
  | "cafe"
  | "note";

export type SchedulePriority = "required" | "flexible" | "optional";

export type ScheduleTimeKind = "reservation" | "target" | "estimate";

export type ScheduleSeedVersion = 1 | 2;

export interface ScheduleActivity {
  id: string;
  routeActivityId?: string;
  routeTimingStale: boolean;
  title: string;
  targetAt: string;
  placeName: string;
  place?: AttachedPlace;
  kind: ScheduleActivityKind;
  durationMinutes: number;
  priority: SchedulePriority;
  timeKind: ScheduleTimeKind;
  estimatedCostMinor?: number;
  notes?: string;
}

export interface SchedulePlan {
  id: string;
  schemaVersion: 1;
  seedVersion: ScheduleSeedVersion;
  title: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  currency: import("../money/types").CurrencyCode;
  travelerCount: number;
  activities: ScheduleActivity[];
  updatedAt: string;
}
