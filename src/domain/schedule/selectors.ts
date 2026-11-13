import type { Activity, TripPlan } from "../trip/types";
import type { ScheduleActivity, SchedulePlan } from "./types";

export function selectNextScheduleActivity(
  plan: SchedulePlan,
  now: Date,
): ScheduleActivity | undefined {
  return sortedActivities(plan).find(
    (activity) => new Date(activity.targetAt).getTime() > now.getTime(),
  );
}

export function selectNextScheduleActivityForToday(
  plan: SchedulePlan,
  now: Date,
): ScheduleActivity | undefined {
  const currentDate = toTimeZoneDate(now, plan.timeZone);
  if (currentDate < plan.startDate) {
    return sortedActivities(plan)[0];
  }
  if (currentDate > plan.endDate) return undefined;

  return sortedActivities(plan).find(
    (activity) =>
      toTimeZoneDate(new Date(activity.targetAt), plan.timeZone) === currentDate &&
      new Date(activity.targetAt).getTime() > now.getTime(),
  );
}

export function selectCurrentScheduleActivityForToday(
  plan: SchedulePlan,
  now: Date,
): ScheduleActivity | undefined {
  const currentDate = toTimeZoneDate(now, plan.timeZone);
  if (currentDate < plan.startDate || currentDate > plan.endDate) {
    return undefined;
  }

  return sortedActivities(plan).find(
    (activity) =>
      toTimeZoneDate(new Date(activity.targetAt), plan.timeZone) === currentDate &&
      isScheduleActivityActive(activity, now),
  );
}

export function isScheduleActivityActive(
  activity: ScheduleActivity,
  now: Date,
): boolean {
  const startsAt = new Date(activity.targetAt).getTime();
  const endsAt = startsAt + activity.durationMinutes * 60_000;
  return startsAt <= now.getTime() && now.getTime() < endsAt;
}

export function isFixedScheduleActivity(
  activity: ScheduleActivity,
): boolean {
  return (
    activity.priority === "required" &&
    (activity.timeKind === "reservation" || activity.timeKind === "target")
  );
}

export function selectFixedScheduleActivityForToday(
  plan: SchedulePlan,
  now: Date,
): ScheduleActivity | undefined {
  const currentDate = toTimeZoneDate(now, plan.timeZone);
  const selectedDate =
    currentDate < plan.startDate
      ? plan.startDate
      : currentDate > plan.endDate
        ? null
        : currentDate;
  if (selectedDate === null) return undefined;

  return sortedActivities(plan).find(
    (activity) =>
      toTimeZoneDate(new Date(activity.targetAt), plan.timeZone) === selectedDate &&
      isFixedScheduleActivity(activity) &&
      (isScheduleActivityActive(activity, now) ||
        new Date(activity.targetAt).getTime() > now.getTime()),
  );
}

export function resolveRouteActivity(
  scheduleActivity: ScheduleActivity,
  routeRegistry: TripPlan,
): Activity | undefined {
  if (scheduleActivity.routeActivityId === undefined) return undefined;
  const routeActivity = routeRegistry.activities.find(
    (activity) => activity.id === scheduleActivity.routeActivityId,
  );
  if (routeActivity === undefined) return undefined;

  return {
    ...routeActivity,
    title: scheduleActivity.title,
    targetAt: scheduleActivity.targetAt,
    placeName: scheduleActivity.placeName,
  };
}

export function selectNextTransitRouteActivity(
  plan: SchedulePlan,
  routeRegistry: TripPlan,
  now: Date,
): Activity | undefined {
  const currentTransit = selectCurrentTransitRouteActivity(
    plan,
    routeRegistry,
    now,
  );
  if (currentTransit !== undefined) return currentTransit;

  for (const scheduleActivity of sortedActivities(plan)) {
    if (new Date(scheduleActivity.targetAt).getTime() <= now.getTime()) continue;
    const resolved = resolveRouteActivity(scheduleActivity, routeRegistry);
    if (resolved?.liveTransitEnabled) return resolved;
  }
  return undefined;
}

export function selectCurrentTransitRouteActivity(
  plan: SchedulePlan,
  routeRegistry: TripPlan,
  now: Date,
): Activity | undefined {
  const current = selectCurrentScheduleActivityForToday(plan, now);
  if (current?.kind !== "transport") return undefined;

  const resolved = resolveRouteActivity(current, routeRegistry);
  return resolved?.liveTransitEnabled ? resolved : undefined;
}

export function selectDisplayedRouteActivityForToday(
  plan: SchedulePlan,
  routeRegistry: TripPlan,
  now: Date,
): Activity | undefined {
  const currentTransit = selectCurrentTransitRouteActivity(
    plan,
    routeRegistry,
    now,
  );
  if (currentTransit !== undefined) return currentTransit;

  const nextSchedule = selectNextScheduleActivityForToday(plan, now);
  return nextSchedule === undefined
    ? undefined
    : resolveRouteActivity(nextSchedule, routeRegistry);
}

export function sortedActivities(plan: SchedulePlan): ScheduleActivity[] {
  return [...plan.activities].sort(
    (left, right) =>
      (Date.parse(left.targetAt) - Date.parse(right.targetAt)) || left.id.localeCompare(right.id),
  );
}

function toTimeZoneDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
