import type { StoredRouteSegment } from "../workspace/types";
import type { ScheduleActivity, SchedulePlan } from "./types";
import { zonedDate } from "../time/zoned";

export function invalidateChangedRouteSegments(
  before: SchedulePlan,
  after: SchedulePlan,
  routeSegments: StoredRouteSegment[] | undefined,
): StoredRouteSegment[] | undefined {
  if (routeSegments === undefined) return undefined;

  const beforeById = new Map(
    before.activities.map((activity) => [activity.id, activity]),
  );
  const afterById = new Map(
    after.activities.map((activity) => [activity.id, activity]),
  );
  const changedIds = new Set<string>();

  for (const [id, previous] of beforeById) {
    const next = afterById.get(id);
    if (next === undefined || routeFingerprint(previous) !== routeFingerprint(next)) {
      changedIds.add(id);
    }
  }

  const adjacentPairs = collectAdjacentPairs(after.activities, after.timeZone);
  return routeSegments.filter(
    (segment) =>
      !changedIds.has(segment.originActivityId) &&
      !changedIds.has(segment.destinationActivityId) &&
      adjacentPairs.has(pairKey(segment.originActivityId, segment.destinationActivityId)),
  );
}

function routeFingerprint(activity: ScheduleActivity): string {
  return JSON.stringify({
    routeActivityId: activity.routeActivityId ?? null,
    targetAt: Date.parse(activity.targetAt),
    durationMinutes: activity.durationMinutes,
    placeName: activity.placeName,
    place:
      activity.place === undefined
        ? null
        : {
            placeId: activity.place.placeId,
            latitude: activity.place.location.latitude,
            longitude: activity.place.location.longitude,
          },
  });
}

function collectAdjacentPairs(activities: ScheduleActivity[], timeZone: string): Set<string> {
  const byDate = new Map<string, ScheduleActivity[]>();
  for (const activity of activities) {
    const date = zonedDate(activity.targetAt, timeZone);
    const day = byDate.get(date) ?? [];
    day.push(activity);
    byDate.set(date, day);
  }

  const pairs = new Set<string>();
  for (const day of byDate.values()) {
    day.sort(
      (left, right) =>
        Date.parse(left.targetAt) - Date.parse(right.targetAt) || left.id.localeCompare(right.id),
    );
    for (let index = 0; index < day.length - 1; index += 1) {
      const origin = day[index];
      const destination = day[index + 1];
      if (origin !== undefined && destination !== undefined) {
        pairs.add(pairKey(origin.id, destination.id));
      }
    }
  }
  return pairs;
}

function pairKey(originActivityId: string, destinationActivityId: string) {
  return `${originActivityId}\u0000${destinationActivityId}`;
}
