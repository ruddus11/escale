import { isTimeZone } from "../domain/time/zoned";
import { isCurrencyCode } from "../domain/money/currency";
import type {
  AttachedPlace,
  PlaceLocation,
} from "../domain/places/types";
import type {
  ScheduleActivity,
  SchedulePlan,
} from "../domain/schedule/types";
import type { TransitOption } from "../domain/transit/types";
import type {
  BudgetSettings,
  LegacyExpense,
  LegacyTripWorkspace,
  StoredRouteSegment,
} from "../domain/workspace/types";
import {
  isDateOnly,
  isIntegerInRange,
  isIsoDateTime,
  isNonEmptyString,
  isRecordWithOnlyKeys,
} from "./schemaGuards";

/** 저장 형식 1(오사카 여행 하나). 예전 저장값과 백업을 읽을 때만 쓴다. */
export function isLegacyTripWorkspace(value: unknown): value is LegacyTripWorkspace {
  if (
    !isRecordWithOnlyKeys(value, [
      "schemaVersion",
      "schedule",
      "budget",
      "expenses",
      "routeSegments",
      "updatedAt",
    ]) ||
    value.schemaVersion !== 1 ||
    !isSchedulePlan(value.schedule) ||
    value.schedule.timeZone !== "Asia/Tokyo" ||
    value.schedule.currency !== "JPY" ||
    !isBudgetSettings(value.budget) ||
    !Array.isArray(value.expenses) ||
    !value.expenses.every(isLegacyExpense) ||
    !isOptionalRouteSegments(value.routeSegments) ||
    !isIsoDateTime(value.updatedAt)
  ) {
    return false;
  }

  return true;
}

/** 경로 캐시는 없어도 되고, 있으면 최근 50개까지만 저장한다. */
export function isOptionalRouteSegments(
  value: unknown,
): value is StoredRouteSegment[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 50 &&
      value.every(isStoredRouteSegment))
  );
}

export function isSchedulePlan(value: unknown): value is SchedulePlan {
  return (
    isRecordWithOnlyKeys(value, [
      "id",
      "schemaVersion",
      "seedVersion",
      "title",
      "startDate",
      "endDate",
      "timeZone",
      "currency",
      "travelerCount",
      "activities",
      "updatedAt",
    ]) &&
    isNonEmptyString(value.id, 80) &&
    value.schemaVersion === 1 &&
    (value.seedVersion === 1 || value.seedVersion === 2) &&
    isNonEmptyString(value.title, 120) &&
    isDateOnly(value.startDate) &&
    isDateOnly(value.endDate) &&
    value.startDate <= value.endDate &&
    isTimeZone(value.timeZone) &&
    isCurrencyCode(value.currency) &&
    isIntegerInRange(value.travelerCount, 1, 20) &&
    Array.isArray(value.activities) &&
    value.activities.every(isScheduleActivity) &&
    new Set(value.activities.map((activity) => activity.id)).size ===
      value.activities.length &&
    isIsoDateTime(value.updatedAt)
  );
}

function isScheduleActivity(value: unknown): value is ScheduleActivity {
  return (
    isRecordWithOnlyKeys(value, [
      "id",
      "routeActivityId",
      "routeTimingStale",
      "title",
      "targetAt",
      "placeName",
      "place",
      "kind",
      "durationMinutes",
      "priority",
      "timeKind",
      "estimatedCostMinor",
      "notes",
    ]) &&
    isNonEmptyString(value.id, 120) &&
    (value.routeActivityId === undefined ||
      isNonEmptyString(value.routeActivityId, 120)) &&
    typeof value.routeTimingStale === "boolean" &&
    isNonEmptyString(value.title, 80) &&
    typeof value.placeName === "string" &&
    value.placeName.length <= 160 &&
    (value.place === undefined || isAttachedPlace(value.place)) &&
    isIsoDateTime(value.targetAt) &&
    [
      "flight",
      "transport",
      "accommodation",
      "shopping",
      "meal",
      "sightseeing",
      "cafe",
      "note",
    ].includes(String(value.kind)) &&
    isIntegerInRange(value.durationMinutes, 0, 720) &&
    ["required", "flexible", "optional"].includes(String(value.priority)) &&
    ["reservation", "target", "estimate"].includes(String(value.timeKind)) &&
    (value.estimatedCostMinor === undefined ||
      isIntegerInRange(value.estimatedCostMinor, 0, 10_000_000)) &&
    (value.notes === undefined ||
      (typeof value.notes === "string" && value.notes.length <= 500))
  );
}

function isAttachedPlace(value: unknown): value is AttachedPlace {
  return (
    isRecordWithOnlyKeys(value, [
      "placeId",
      "displayName",
      "formattedAddress",
      "location",
      "googleMapsUri",
      "attachedAt",
    ]) &&
    isNonEmptyString(value.placeId, 300) &&
    isNonEmptyString(value.displayName, 160) &&
    typeof value.formattedAddress === "string" &&
    value.formattedAddress.length <= 300 &&
    isPlaceLocation(value.location) &&
    typeof value.googleMapsUri === "string" &&
    value.googleMapsUri.startsWith("https://") &&
    value.googleMapsUri.length <= 500 &&
    isIsoDateTime(value.attachedAt)
  );
}

function isPlaceLocation(value: unknown): value is PlaceLocation {
  return (
    isRecordWithOnlyKeys(value, ["latitude", "longitude"]) &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude)
  );
}

export function isStoredRouteSegment(value: unknown): value is StoredRouteSegment {
  return (
    isRecordWithOnlyKeys(value, [
      "originActivityId",
      "destinationActivityId",
      "departureBasis",
      "options",
      "fetchedAt",
    ]) &&
    isNonEmptyString(value.originActivityId, 120) &&
    isNonEmptyString(value.destinationActivityId, 120) &&
    ["plan", "now"].includes(String(value.departureBasis)) &&
    Array.isArray(value.options) &&
    value.options.length <= 3 &&
    value.options.every(isStoredTransitOption) &&
    isIsoDateTime(value.fetchedAt)
  );
}

const storedOptionBaseKeys = [
  "id",
  "kind",
  "label",
  "routeDepartureAt",
  "routeArrivalAt",
  "durationMinutes",
  "fetchedAt",
] as const;

function isStoredTransitOption(value: unknown): value is TransitOption {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const kind = (value as Record<string, unknown>).kind;

  if (kind === "walk") {
    return (
      isRecordWithOnlyKeys(value, [...storedOptionBaseKeys, "walkingMinutes"]) &&
      hasStoredOptionBaseFields(value) &&
      isIntegerInRange(value.walkingMinutes, 0, 1_440)
    );
  }

  if (kind === "transit") {
    return (
      isRecordWithOnlyKeys(value, [
        ...storedOptionBaseKeys,
        "firstTransitDepartureAt",
        "leaveCurrentLocationAt",
        "accessWalkMinutes",
        "transferCount",
        "lines",
      ]) &&
      hasStoredOptionBaseFields(value) &&
      isIsoDateTime(value.firstTransitDepartureAt) &&
      isIsoDateTime(value.leaveCurrentLocationAt) &&
      isIntegerInRange(value.accessWalkMinutes, 0, 1_440) &&
      isIntegerInRange(value.transferCount, 0, 20) &&
      Array.isArray(value.lines) &&
      value.lines.every(isTransitLine)
    );
  }

  return false;
}

function hasStoredOptionBaseFields(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.id, 200) &&
    isNonEmptyString(value.label, 40) &&
    isIsoDateTime(value.routeDepartureAt) &&
    isIsoDateTime(value.routeArrivalAt) &&
    isIntegerInRange(value.durationMinutes, 0, 1_440) &&
    isIsoDateTime(value.fetchedAt)
  );
}

function isTransitLine(value: unknown): boolean {
  if (
    !isRecordWithOnlyKeys(value, [
      "shortName",
      "headsign",
      "vehicleType",
      "departureStopName",
      "arrivalStopName",
    ])
  ) {
    return false;
  }

  return [
    value.shortName,
    value.headsign,
    value.vehicleType,
    value.departureStopName,
    value.arrivalStopName,
  ].every((field) => typeof field === "string" && field.length <= 120);
}

const EXPENSE_CATEGORIES = ["transport", "food", "drink", "admission", "shopping", "other"];

// 분류별 비율은 0~100 정수이고 합이 정확히 100이어야 한다.
function isCategoryShares(value: unknown): boolean {
  if (!isRecordWithOnlyKeys(value, EXPENSE_CATEGORIES)) return false;
  const shares = Object.values(value);
  return (
    shares.length > 0 &&
    shares.every((v) => isIntegerInRange(v, 0, 100)) &&
    shares.reduce((sum: number, v) => sum + (v as number), 0) === 100
  );
}

export function isBudgetSettings(value: unknown): value is BudgetSettings {
  return (
    isRecordWithOnlyKeys(value, [
      "totalBudgetMinor",
      "emergencyReserveMinor",
      "mealBudgetPerPersonMinor",
      "dailyBudgetMinor",
      "categoryShares",
    ]) &&
    (value.dailyBudgetMinor === undefined ||
      isIntegerInRange(value.dailyBudgetMinor, 0, 100_000_000)) &&
    (value.categoryShares === undefined || isCategoryShares(value.categoryShares)) &&
    (value.totalBudgetMinor === undefined ||
      isIntegerInRange(value.totalBudgetMinor, 0, 100_000_000)) &&
    isIntegerInRange(value.emergencyReserveMinor, 0, 100_000_000) &&
    (value.mealBudgetPerPersonMinor === undefined ||
      isIntegerInRange(value.mealBudgetPerPersonMinor, 0, 10_000_000))
  );
}

function isLegacyExpense(value: unknown): value is LegacyExpense {
  return (
    isRecordWithOnlyKeys(value, [
      "id",
      "amountMinor",
      "category",
      "note",
      "occurredAt",
    ]) &&
    isNonEmptyString(value.id, 120) &&
    isIntegerInRange(value.amountMinor, 1, 100_000_000) &&
    ["transport", "food", "drink", "admission", "shopping", "other"].includes(
      String(value.category),
    ) &&
    (value.note === undefined ||
      (typeof value.note === "string" && value.note.length <= 200)) &&
    isIsoDateTime(value.occurredAt)
  );
}
