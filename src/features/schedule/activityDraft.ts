import { fromLocal, deviceTimeZone, localDateTime } from "../../domain/time/zoned";
import { parseMoney, moneyInput } from "../../domain/money/currency";
import type { CurrencyCode } from "../../domain/money/types";
import type { AttachedPlace } from "../../domain/places/types";
import type {
  ScheduleActivity,
  ScheduleActivityKind,
  SchedulePlan,
  SchedulePriority,
  ScheduleTimeKind,
} from "../../domain/schedule/types";

export interface ActivityDraft {
  title: string;
  date: string;
  time: string;
  placeName: string;
  place?: AttachedPlace;
  kind: ScheduleActivityKind;
  durationMinutes: string;
  priority: SchedulePriority;
  timeKind: ScheduleTimeKind;
  estimatedCostMinor: string;
  notes: string;
}

export type ActivityDraftErrors = Partial<Record<keyof ActivityDraft, string>>;

export function createActivityDraft(
  activity: ScheduleActivity | undefined,
  defaultDate: string,
  timeZone = deviceTimeZone(),
  currency: CurrencyCode = "KRW",
): ActivityDraft {
  if (activity === undefined) {
    return {
      title: "",
      date: defaultDate,
      time: "10:00",
      placeName: "",
      kind: "note",
      durationMinutes: "30",
      priority: "flexible",
      timeKind: "estimate",
      estimatedCostMinor: "",
      notes: "",
    };
  }

  return {
    title: activity.title,
    date: localDateTime(activity.targetAt, timeZone).slice(0, 10),
    time: localDateTime(activity.targetAt, timeZone).slice(11, 16),
    placeName: activity.placeName,
    kind: activity.kind,
    durationMinutes: String(activity.durationMinutes),
    priority: activity.priority,
    timeKind: activity.timeKind,
    estimatedCostMinor:
      activity.estimatedCostMinor === undefined
        ? ""
        : moneyInput(activity.estimatedCostMinor, currency),
    notes: activity.notes ?? "",
    ...(activity.place === undefined ? {} : { place: activity.place }),
  };
}

export function validateActivityDraft(
  draft: ActivityDraft,
  plan: SchedulePlan,
): ActivityDraftErrors {
  const errors: ActivityDraftErrors = {};
  const title = draft.title.trim();
  const placeName = draft.placeName.trim();
  const notes = draft.notes.trim();

  if (title.length === 0 || title.length > 80) {
    errors.title = "일정 이름은 1~80자로 입력해주세요.";
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    draft.date < plan.startDate ||
    draft.date > plan.endDate
  ) {
    errors.date = `${plan.startDate}부터 ${plan.endDate} 사이를 선택해주세요.`;
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) {
    errors.time = "올바른 시각을 입력해주세요.";
  }
  if (!errors.date && !errors.time) {
    try { fromLocal(draft.date, draft.time, plan.timeZone); }
    catch { errors.time = "현지에 없거나 두 번 나타나는 시각입니다. 다른 시각을 선택해주세요."; }
  }
  if (placeName.length > 160) {
    errors.placeName = "장소명은 160자 이하로 입력해주세요.";
  }
  if (!isIntegerStringInRange(draft.durationMinutes, 0, 720)) {
    errors.durationMinutes = "체류시간은 0~720분의 정수로 입력해주세요.";
  }
  const estimatedCost = parseMoney(draft.estimatedCostMinor, plan.currency);
  if (
    draft.estimatedCostMinor.trim().length > 0 &&
    (estimatedCost === undefined || estimatedCost > 10_000_000)
  ) {
    errors.estimatedCostMinor = "예상비용을 통화의 소수 자릿수에 맞게 입력해주세요.";
  }
  if (notes.length > 500) {
    errors.notes = "메모는 500자 이하로 입력해주세요.";
  }

  return errors;
}

export function saveActivityDraft(
  draft: ActivityDraft,
  plan: SchedulePlan,
  original?: ScheduleActivity,
  idFactory: () => string = defaultIdFactory,
): ScheduleActivity {
  const errors = validateActivityDraft(draft, plan);
  if (Object.keys(errors).length > 0) {
    throw new TypeError("Invalid activity draft");
  }

  const targetAt = fromLocal(draft.date, draft.time, plan.timeZone);
  const placeName = draft.placeName.trim();
  const placeChanged =
    original !== undefined && placeName !== original.placeName.trim();
  const timeChanged = original !== undefined && targetAt !== original.targetAt;
  const routeActivityId = placeChanged ? undefined : original?.routeActivityId;
  const estimatedCost = draft.estimatedCostMinor.trim();
  const notes = draft.notes.trim();

  return {
    id: original?.id ?? `user-${idFactory()}`,
    ...(routeActivityId === undefined ? {} : { routeActivityId }),
    routeTimingStale:
      routeActivityId === undefined
        ? false
        : Boolean(original?.routeTimingStale || timeChanged),
    title: draft.title.trim(),
    targetAt,
    placeName,
    ...(draft.place === undefined ? {} : { place: draft.place }),
    kind: draft.kind,
    durationMinutes: Number(draft.durationMinutes),
    priority: draft.priority,
    timeKind: draft.timeKind,
    ...(estimatedCost.length === 0
      ? {}
      : { estimatedCostMinor: parseMoney(estimatedCost, plan.currency)! }),
    ...(notes.length === 0 ? {} : { notes }),
  };
}

function isIntegerStringInRange(
  value: string,
  minimum: number,
  maximum: number,
): boolean {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum;
}

function defaultIdFactory(): string {
  return crypto.randomUUID();
}
