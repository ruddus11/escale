import type { ScheduleActivity } from "../../domain/schedule/types";
import type {
  BudgetSettings,
  TripLibrary,
  TripWorkspace,
} from "../../domain/workspace/types";

const replacedActivityIds = new Set([
  "schedule-day2-breakfast",
  "schedule-day2-to-usj",
  "schedule-day2-usj-open",
  "schedule-day2-usj-lunch",
  "schedule-day2-usj-afternoon",
  "schedule-day2-from-usj",
  "schedule-day2-lunch",
  "schedule-day2-to-kaiyukan",
  "schedule-day2-kaiyukan",
  "schedule-day2-to-dotonbori",
  "schedule-day2-dotonbori",
  "schedule-day2-hotel",
  "schedule-day4-breakfast",
  "schedule-day4-to-kyoto",
  "schedule-day4-to-higashi",
  "schedule-day4-higashi",
  "schedule-day4-to-sando",
  "schedule-day4-lunch",
  "schedule-day4-market",
  "schedule-day4-ayanokoji",
  "schedule-day4-porta",
  "schedule-day4-fukucha",
  "schedule-day4-isetan",
  "schedule-day4-to-hotel",
  "schedule-day4-walk",
  "schedule-day4-rest",
  "schedule-day4-dinner",
  "schedule-day4-yoiyama",
  "schedule-day4-hotel",
  "schedule-day5-drugstore",
  "schedule-day5-hotel-return",
  "schedule-day5-to-airport",
  "schedule-day5-checkin",
]);

const replacementActivityIds = new Set([
  "schedule-day1-cjj-checkin",
  "schedule-day1-checkin-deadline",
  "schedule-day1-hotel-return",
  "schedule-day2-lunch",
  "schedule-day2-to-kaiyukan",
  "schedule-day2-kaiyukan",
  "schedule-day2-to-dotonbori",
  "schedule-day2-dotonbori",
  "schedule-day2-hotel",
  "schedule-day4-breakfast",
  "schedule-day4-to-kyoto",
  "schedule-day4-lunch",
  "schedule-day4-walk",
  "schedule-day4-rest",
  "schedule-day4-dinner",
  "schedule-day4-yoiyama",
  "schedule-day4-hotel",
  "schedule-day5-hotel-return",
  "schedule-day5-to-airport",
  "schedule-day5-checkin",
  "schedule-day5-at-gate",
]);

function legacyActivity(
  id: string,
  title: string,
  targetAt: string,
  placeName: string,
  kind: ScheduleActivity["kind"],
  durationMinutes: number,
  priority: ScheduleActivity["priority"],
  timeKind: ScheduleActivity["timeKind"],
  notes?: string,
): ScheduleActivity {
  return {
    id,
    routeTimingStale: false,
    title,
    targetAt,
    placeName,
    kind,
    durationMinutes,
    priority,
    timeKind,
    ...(notes === undefined ? {} : { notes }),
  };
}

// These are the exact same-ID defaults that were shipped under seed v1.
// Only an exact match is replaceable; any changed field or attached place is
// treated as user data and survives the migration.
const legacySameIdDefaults: Record<string, readonly ScheduleActivity[]> = {
  "schedule-day2-lunch": [
    legacyActivity("schedule-day2-lunch", "호텔 근처 늦은 점심", "2026-07-21T13:00:00+09:00", "호텔 근처 · 현장 선택", "meal", 60, "flexible", "estimate"),
  ],
  "schedule-day2-to-kaiyukan": [
    legacyActivity("schedule-day2-to-kaiyukan", "호텔에서 가이유칸으로 이동", "2026-07-21T14:10:00+09:00", "가이유칸", "transport", 35, "required", "estimate"),
  ],
  "schedule-day2-kaiyukan": [
    legacyActivity("schedule-day2-kaiyukan", "가이유칸", "2026-07-21T15:00:00+09:00", "오사카 가이유칸", "sightseeing", 180, "required", "target", "시간 지정 티켓 구매 후 예약시간으로 변경"),
  ],
  "schedule-day2-to-dotonbori": [
    legacyActivity("schedule-day2-to-dotonbori", "가이유칸에서 도톤보리로 이동", "2026-07-21T18:10:00+09:00", "도톤보리", "transport", 50, "required", "estimate"),
  ],
  "schedule-day2-dotonbori": [
    legacyActivity("schedule-day2-dotonbori", "도톤보리 저녁·산책", "2026-07-21T19:00:00+09:00", "도톤보리", "meal", 120, "flexible", "estimate"),
  ],
  "schedule-day4-breakfast": [
    legacyActivity("schedule-day4-breakfast", "아침 식사", "2026-07-23T09:30:00+09:00", "호텔 근처 또는 벤텐초역", "meal", 60, "flexible", "estimate", "USJ·쇼핑 피로 회복 위해 늦게 출발"),
  ],
  "schedule-day4-to-kyoto": [
    legacyActivity("schedule-day4-to-kyoto", "호텔에서 교토역으로 이동", "2026-07-23T09:00:00+09:00", "교토역", "transport", 70, "required", "estimate"),
  ],
  "schedule-day4-lunch": [
    legacyActivity("schedule-day4-lunch", "교토타워 산도 B1 점심", "2026-07-23T11:05:00+09:00", "교토타워 산도 B1", "meal", 70, "flexible", "estimate"),
  ],
  "schedule-day4-dinner": [
    legacyActivity("schedule-day4-dinner", "호텔 근처 저녁", "2026-07-23T18:30:00+09:00", "호텔 근처 · 현장 선택", "meal", 75, "flexible", "estimate"),
  ],
  "schedule-day5-hotel-return": [
    legacyActivity("schedule-day5-hotel-return", "호텔 복귀·짐 수령·최종 정리", "2026-07-24T09:35:00+09:00", "아트 호텔 오사카 베이 타워", "accommodation", 35, "required", "estimate", "보조배터리·전자담배는 기내수하물, 액체·날카로운 물건은 위탁수하물"),
  ],
  "schedule-day5-to-airport": [
    legacyActivity("schedule-day5-to-airport", "벤텐초에서 간사이공항 이동", "2026-07-24T10:25:00+09:00", "간사이국제공항 T1", "transport", 65, "required", "estimate", "JR 간쿠쾌속, Kansai-airport·関西空港 방향 확인. 늦어도 10:10 출발"),
  ],
  "schedule-day5-checkin": [
    legacyActivity("schedule-day5-checkin", "공항 체크인·출국 수속", "2026-07-24T11:30:00+09:00", "간사이국제공항 T1", "transport", 60, "required", "estimate", "티웨이 카운터→위탁수하물→보안검색→출국심사. 11:30 전후 도착 목표"),
  ],
};

interface WorkspaceMigrationResult {
  workspace: TripWorkspace;
  migrated: boolean;
}

function isUntouchedVersionOneBudget(budget: BudgetSettings): boolean {
  return (
    budget.totalBudgetMinor === undefined &&
    budget.emergencyReserveMinor === 0 &&
    budget.mealBudgetPerPersonMinor === undefined
  );
}

export function migrateTripWorkspace(
  storedWorkspace: TripWorkspace,
  seed: TripWorkspace,
): WorkspaceMigrationResult {
  if (
    storedWorkspace.schedule.seedVersion !== 1 ||
    seed.schedule.seedVersion !== 2
  ) {
    return {
      workspace: structuredClone(storedWorkspace),
      migrated: false,
    };
  }

  const seedReplacementById = new Map(
    seed.schedule.activities
      .filter((activity) => replacementActivityIds.has(activity.id))
      .map((activity) => [activity.id, activity]),
  );
  const preservedReplacementIds = new Set<string>();
  const actuallyReplacedIds = new Set<string>();
  const preservedActivities = storedWorkspace.schedule.activities.filter(
    (activity) => {
      if (!replacedActivityIds.has(activity.id)) return true;
      const replacement = seedReplacementById.get(activity.id);
      if (
        replacement !== undefined &&
        shouldPreserveReplacement(activity, replacement)
      ) {
        preservedReplacementIds.add(activity.id);
        return true;
      }
      actuallyReplacedIds.add(activity.id);
      return false;
    },
  );
  const replacementActivities = seed.schedule.activities.filter(
    (activity) =>
      replacementActivityIds.has(activity.id) &&
      !preservedReplacementIds.has(activity.id),
  );
  const activities = [...preservedActivities, ...replacementActivities].sort(
    (left, right) =>
      left.targetAt.localeCompare(right.targetAt) || left.id.localeCompare(right.id),
  );
  const budget = isUntouchedVersionOneBudget(storedWorkspace.budget)
    ? structuredClone(seed.budget)
    : structuredClone(storedWorkspace.budget);
  const routeSegments = storedWorkspace.routeSegments?.filter(
    (segment) =>
      !actuallyReplacedIds.has(segment.originActivityId) &&
      !actuallyReplacedIds.has(segment.destinationActivityId),
  );

  return {
    workspace: {
      ...structuredClone(storedWorkspace),
      schedule: {
        ...structuredClone(storedWorkspace.schedule),
        seedVersion: 2,
        activities,
        updatedAt: seed.schedule.updatedAt,
      },
      budget,
      ...(routeSegments === undefined ? {} : { routeSegments }),
      updatedAt: seed.updatedAt,
    },
    migrated: true,
  };
}

function shouldPreserveReplacement(
  activity: ScheduleActivity,
  replacement: ScheduleActivity,
): boolean {
  // Keeping an identical object avoids invalidating a still-valid cached route.
  if (scheduleActivitiesEqual(activity, replacement)) return true;
  return !legacySameIdDefaults[activity.id]?.some((legacyDefault) =>
    scheduleActivitiesEqual(activity, legacyDefault),
  );
}

const scheduleActivityFields: readonly (keyof ScheduleActivity)[] = [
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
];

function scheduleActivitiesEqual(
  left: ScheduleActivity,
  right: ScheduleActivity,
): boolean {
  return scheduleActivityFields.every(
    (field) => JSON.stringify(left[field]) === JSON.stringify(right[field]),
  );
}

interface LibraryMigrationResult {
  library: TripLibrary;
  migrated: boolean;
}

/** 기본 일정 갱신은 기본 수첩과 id가 같은 수첩에만 적용한다. 사용자가 만든 수첩은 건드리지 않는다. */
export function migrateTripLibrary(
  library: TripLibrary,
  seed: TripWorkspace,
): LibraryMigrationResult {
  let migrated = false;
  const trips = library.trips.map((trip) => {
    if (trip.id !== seed.id) return trip;
    const result = migrateTripWorkspace(trip, seed);
    migrated ||= result.migrated;
    return result.workspace;
  });

  return migrated
    ? { library: { ...structuredClone(library), trips, updatedAt: seed.updatedAt }, migrated }
    : { library: structuredClone(library), migrated };
}
