import { fromLocal } from "../../domain/time/zoned";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { APP_COLUMN_MAX_WIDTH } from "../../app/frame";
import {
  isFixedScheduleActivity,
  resolveRouteActivity,
  selectCurrentScheduleActivityForToday,
  selectCurrentTransitRouteActivity,
  selectDisplayedRouteActivityForToday,
  selectFixedScheduleActivityForToday,
  selectNextScheduleActivityForToday,
  sortedActivities,
} from "../../domain/schedule/selectors";
import type {
  ScheduleActivity,
  SchedulePlan,
} from "../../domain/schedule/types";
import { selectNextActivity } from "../../domain/trip/selectNextActivity";
import type { TripPlan } from "../../domain/trip/types";
import { NextMoveCard } from "./NextMoveCard";
import { NextScheduleCard } from "./NextScheduleCard";
import { ScheduleStatusPanel } from "./ScheduleStatusPanel";
import {
  ScheduleTimeline,
  type TimelineActivity,
} from "./ScheduleTimeline";
import { TripDateStrip } from "./TripDateStrip";

interface TodayScreenProps {
  plan: TripPlan;
  now: Date;
  onOpenTransit: () => void;
  schedulePlan?: SchedulePlan;
}

export function TodayScreen({
  plan,
  now,
  onOpenTransit,
  schedulePlan,
}: TodayScreenProps) {
  const nextScheduleActivity =
    schedulePlan === undefined
      ? undefined
      : selectNextScheduleActivityForToday(schedulePlan, now);
  const currentScheduleActivity =
    schedulePlan === undefined
      ? undefined
      : selectCurrentScheduleActivityForToday(schedulePlan, now);
  const currentTransitActivity =
    schedulePlan === undefined
      ? undefined
      : selectCurrentTransitRouteActivity(schedulePlan, plan, now);
  const nextActivity =
    schedulePlan === undefined
      ? selectNextActivity(plan, now)
      : nextScheduleActivity === undefined
        ? undefined
        : resolveRouteActivity(nextScheduleActivity, plan);
  const displayedRouteActivity =
    schedulePlan === undefined
      ? nextActivity
      : selectDisplayedRouteActivityForToday(schedulePlan, plan, now);
  const goalScheduleActivity =
    schedulePlan === undefined
      ? undefined
      : selectFixedScheduleActivityForToday(schedulePlan, now);
  const staticGoalActivity = plan.activities.find(
    (activity) => activity.id === "umeda-sky-observatory",
  );
  const { upcomingActivities, goalActivityId } = createTimeline(
    plan,
    schedulePlan,
    nextScheduleActivity,
    goalScheduleActivity,
    staticGoalActivity,
    now,
  );
  const localTime = new Intl.DateTimeFormat("ko-KR", {
    timeZone: plan.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const localDate = new Intl.DateTimeFormat("ko-KR", {
    timeZone: plan.timeZone,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  const tripPhase =
    schedulePlan === undefined
      ? getTripPhase(plan, now)
      : getScheduleTripPhase(
          schedulePlan,
          now,
          sortedActivities(schedulePlan)[0]?.targetAt,
        );
  const todayStatusPhase =
    tripPhase === "active" &&
    currentScheduleActivity === undefined &&
    nextScheduleActivity === undefined &&
    nextActivity === undefined
      ? "complete"
      : tripPhase;
  const startAt =
    schedulePlan === undefined
      ? plan.activities[0]?.targetAt ?? now.toISOString()
      : fromLocal(schedulePlan.startDate, "12:00", schedulePlan.timeZone);
  const dayCount =
    schedulePlan === undefined
      ? 5
      : differenceInCalendarDays(
          schedulePlan.startDate,
          schedulePlan.endDate,
        ) + 1;
  const selectedDay = selectedTripDay(startAt, dayCount, now, plan.timeZone);
  return (
    <VStack className="today-screen" id="today" maxWidth={APP_COLUMN_MAX_WIDTH} gap={5}>
      <HStack as="header" justify="between" align="end" gap={3}>
        <VStack gap={0.5}>
          <Text type="supporting" weight="semibold">
            DAY {selectedDay}
          </Text>
          <Heading level={1}>오늘</Heading>
        </VStack>
        <VStack gap={0.5} align="end">
          <Text size="2xl" weight="bold" hasTabularNumbers>
            {localTime}
          </Text>
          <Text type="supporting" size="sm">
            {localDate.replace(/[()]/g, "")}
          </Text>
        </VStack>
      </HStack>

      <TripDateStrip
        startAt={startAt}
        dayCount={dayCount}
        now={now}
        timeZone={plan.timeZone}
      />

      <VStack as="main" gap={4}>
        <ScheduleStatusPanel phase={todayStatusPhase} />

        {currentScheduleActivity === undefined ||
        currentScheduleActivity.id === nextScheduleActivity?.id ||
        currentTransitActivity !== undefined ? null : (
          <NextScheduleCard timeZone={plan.timeZone}
            activity={currentScheduleActivity}
            now={now}
            isFixed={isFixedScheduleActivity(currentScheduleActivity)}
            showMapLink={currentScheduleActivity.kind === "transport"}
            headingId="current-schedule-title"
          />
        )}

        {displayedRouteActivity ? (
          <NextMoveCard timeZone={plan.timeZone}
            activity={displayedRouteActivity}
            now={now}
            onOpenTransit={onOpenTransit}
            routeTimingStale={
              currentTransitActivity === undefined
                ? nextScheduleActivity?.routeTimingStale
                : currentScheduleActivity?.routeTimingStale
            }
            status={
              currentTransitActivity === undefined ? "next" : "current"
            }
          />
        ) : nextScheduleActivity !== undefined ? (
          <NextScheduleCard timeZone={plan.timeZone}
            activity={nextScheduleActivity}
            now={now}
            isFixed={isFixedScheduleActivity(nextScheduleActivity)}
          />
        ) : null}

        <ScheduleTimeline timeZone={plan.timeZone}
          activities={upcomingActivities}
          goalActivityId={goalActivityId}
        />
      </VStack>
    </VStack>
  );
}

function getScheduleTripPhase(
  plan: SchedulePlan,
  now: Date,
  tripStartsAt?: string,
): TripPhase {
  const lastActivity = sortedActivities(plan).at(-1);
  if (lastActivity === undefined) return "empty";
  const currentDate = toTimeZoneDate(now, plan.timeZone);
  if (currentDate < plan.startDate) return "before";
  if (
    tripStartsAt !== undefined &&
    now.getTime() < new Date(tripStartsAt).getTime()
  ) {
    return "before";
  }
  const tripEndsAt =
    new Date(lastActivity.targetAt).getTime() +
    lastActivity.durationMinutes * 60_000;
  if (now.getTime() < tripEndsAt) {
    return "active";
  }
  return "complete";
}

type TripPhase = "empty" | "before" | "active" | "complete";

function getTripPhase(plan: TripPlan, now: Date): TripPhase {
  const firstActivity = plan.activities[0];
  const lastActivity = plan.activities.at(-1);

  if (firstActivity === undefined || lastActivity === undefined) {
    return "empty";
  }

  const tripStart = new Date(
    firstActivity.plannedRoute.leaveCurrentLocationAt,
  ).getTime();
  const tripEnd = new Date(lastActivity.targetAt).getTime();

  if (now.getTime() < tripStart) return "before";
  if (now.getTime() <= tripEnd) return "active";
  return "complete";
}

function createTimeline(
  plan: TripPlan,
  schedulePlan: SchedulePlan | undefined,
  nextScheduleActivity: ScheduleActivity | undefined,
  goalScheduleActivity: ScheduleActivity | undefined,
  staticGoalActivity: TripPlan["activities"][number] | undefined,
  now: Date,
): { upcomingActivities: TimelineActivity[]; goalActivityId?: string } {
  if (schedulePlan === undefined) {
    const future = plan.activities.filter(
      (activity) => new Date(activity.targetAt).getTime() > now.getTime(),
    );
    const nextId = future[0]?.id;
    const regular = future
      .filter(
        (activity) =>
          activity.id !== nextId && activity.id !== staticGoalActivity?.id,
      )
      .slice(0, 2)
      .map((activity) => ({
        id: activity.id,
        title: activity.title,
        targetAt: activity.targetAt,
        detail: activity.plannedRoute.modeLabel,
      }));
    const goal =
      staticGoalActivity !== undefined &&
      new Date(staticGoalActivity.targetAt).getTime() > now.getTime()
        ? {
            id: staticGoalActivity.id,
            title: staticGoalActivity.title,
            targetAt: staticGoalActivity.targetAt,
            detail: staticGoalActivity.plannedRoute.modeLabel,
          }
        : undefined;
    return {
      upcomingActivities: goal === undefined ? regular : [...regular, goal],
      ...(goal === undefined ? {} : { goalActivityId: goal.id }),
    };
  }

  const timelineDate =
    toTimeZoneDate(new Date(nextScheduleActivity?.targetAt ?? now), schedulePlan.timeZone);
  const future = sortedActivities(schedulePlan).filter(
    (activity) =>
      toTimeZoneDate(new Date(activity.targetAt), schedulePlan.timeZone) === timelineDate &&
      new Date(activity.targetAt).getTime() > now.getTime(),
  );
  const regular = future
    .filter(
      (activity) =>
        activity.id !== nextScheduleActivity?.id &&
        activity.id !== goalScheduleActivity?.id,
    )
    .slice(0, 2)
    .map((activity) => toTimelineActivity(activity, plan));
  const goal =
    goalScheduleActivity !== undefined &&
    goalScheduleActivity.id !== nextScheduleActivity?.id &&
    toTimeZoneDate(new Date(goalScheduleActivity.targetAt), schedulePlan.timeZone) === timelineDate &&
    new Date(goalScheduleActivity.targetAt).getTime() > now.getTime()
      ? toTimelineActivity(goalScheduleActivity, plan)
      : undefined;
  return {
    upcomingActivities: goal === undefined ? regular : [...regular, goal],
    ...(goal === undefined ? {} : { goalActivityId: goal.id }),
  };
}

function toTimelineActivity(
  activity: ScheduleActivity,
  routeRegistry: TripPlan,
): TimelineActivity {
  const resolved = resolveRouteActivity(activity, routeRegistry);
  return {
    id: activity.id,
    title: activity.title,
    targetAt: activity.targetAt,
    detail:
      resolved?.plannedRoute.modeLabel ??
      (activity.placeName.trim().length > 0 ? activity.placeName : "장소 미정"),
  };
}

function selectedTripDay(
  startAt: string,
  dayCount: number,
  now: Date,
  timeZone: string,
): number {
  const startDate = toTimeZoneDate(new Date(startAt), timeZone);
  const currentDate = toTimeZoneDate(now, timeZone);
  return Math.min(
    dayCount,
    Math.max(1, differenceInCalendarDays(startDate, currentDate) + 1),
  );
}

function differenceInCalendarDays(startDate: string, endDate: string): number {
  return (
    (Date.parse(`${endDate}T00:00:00Z`) -
      Date.parse(`${startDate}T00:00:00Z`)) /
    86_400_000
  );
}

function toTimeZoneDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
