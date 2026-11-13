import type { Activity, TripPlan } from "./types";

export function selectNextActivity(
  plan: TripPlan,
  now: Date,
): Activity | undefined {
  return plan.activities.find(
    (activity) => new Date(activity.targetAt).getTime() > now.getTime(),
  );
}

export function selectNextLiveTransitActivity(
  plan: TripPlan,
  now: Date,
): Activity | undefined {
  return plan.activities.find(
    (activity) =>
      activity.liveTransitEnabled &&
      new Date(activity.targetAt).getTime() > now.getTime(),
  );
}
