import { isReservationList } from "../reservations/reservations";
import type { Reservation } from "../reservations/types";
import { deviceTimeZone, isTimeZone, zonedIso, zonedDate } from "../time/zoned";
import { isCurrencyCode } from "../money/currency";
import type { CurrencyCode, Member } from "../money/types";
import type { CoverColor, TripLedger, TripSettings, TripWorkspace } from "./types";

const OWNER_ID = "me";
const MAX_TRIP_DAYS = 60;

export interface TripFormMember {
  /** 이미 있는 동행자면 id를 유지한다. 새로 적은 이름은 비워 둔다. */
  id?: string;
  name: string;
}

export interface TripFormInput {
  reservations?: Reservation[];
  title: string;
  destination?: string;
  timeZone?: string;
  localCurrency?: CurrencyCode;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  baseCurrency: CurrencyCode;
  /** 첫 사람이 총무('나') */
  members: TripFormMember[];
  coverColor: CoverColor;
}

export type TripFormIssue =
  | "reservations"
  | "time-zone"
  | "currency"
  | "currency-in-use"
  | "schedule-dates"
  | "destination"
  | "title"
  | "dates"
  | "too-long"
  | "members"
  | "member-name"
  | "duplicate-member"
  | "owner-removed"
  | "member-in-use";

/** 새 수첩·여행 설정 양식 검사. 수정할 때는 trip을 넘겨 총무와 장부에 있는 사람을 지킨다. */
export function validateTripForm(
  input: TripFormInput,
  trip?: TripWorkspace,
): TripFormIssue[] {
  const issues: TripFormIssue[] = [];
  if (input.reservations !== undefined && !isReservationList(input.reservations)) issues.push("reservations");
  if (!isTimeZone(input.timeZone ?? deviceTimeZone())) issues.push("time-zone");
  if (!isCurrencyCode(input.baseCurrency) || !isCurrencyCode(input.localCurrency ?? input.baseCurrency)) issues.push("currency");
  if ((input.destination?.trim().length ?? 0) > 120) issues.push("destination");
  const title = input.title.trim();
  if (title.length === 0 || title.length > 120) issues.push("title");

  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (start === undefined || end === undefined || start > end) {
    issues.push("dates");
  } else if ((end - start) / 86_400_000 + 1 > MAX_TRIP_DAYS) {
    issues.push("too-long");
  }

  const names = input.members.map((member) => member.name.trim());
  if (names.length === 0 || names.length > 20) issues.push("members");
  if (names.some((name) => name.length === 0 || name.length > 40)) {
    issues.push("member-name");
  }
  if (new Set(names).size !== names.length) issues.push("duplicate-member");

  if (trip !== undefined) {
    const hasMoney = trip.ledger.expenses.length > 0 ||
      trip.ledger.fundContributions.length > 0 || trip.ledger.payments.length > 0 ||
      trip.budget.totalBudgetMinor !== undefined || trip.budget.emergencyReserveMinor > 0 ||
      trip.budget.mealBudgetPerPersonMinor !== undefined;
    const hasEstimatedCosts = trip.schedule.activities.some(activity =>
      activity.estimatedCostMinor !== undefined);
    if ((hasMoney && input.baseCurrency !== trip.settings.baseCurrency) ||
      (hasEstimatedCosts && (input.localCurrency ?? input.baseCurrency) !== trip.settings.localCurrency)) {
      issues.push("currency-in-use");
    }
    if (!issues.includes("time-zone") && trip.schedule.activities.some(activity => {
      const date = zonedDate(activity.targetAt, input.timeZone ?? trip.settings.timeZone);
      return date < input.startDate || date > input.endDate;
    })) {
      issues.push("schedule-dates");
    }
    const keptIds = new Set(input.members.flatMap((member) => member.id ?? []));
    if (!keptIds.has(trip.settings.ownerId) || input.members[0]?.id !== trip.settings.ownerId) {
      issues.push("owner-removed");
    }
    const inUse = referencedMemberIds(trip.ledger);
    if ([...inUse].some((memberId) => !keptIds.has(memberId))) {
      issues.push("member-in-use");
    }
  }

  return issues;
}

export function createTrip(
  input: TripFormInput,
  { id, now }: { id: string; now: Date },
): TripWorkspace {
  assertValid(validateTripForm(input));
  const updatedAt = now.toISOString();
  const settings = buildSettings(input, assignMemberIds(input.members, []));

  return {
    id,
    settings,
    schedule: {
      id,
      schemaVersion: 1,
      seedVersion: 2,
      title: settings.title,
      startDate: settings.startDate,
      endDate: settings.endDate,
      timeZone: settings.timeZone,
      currency: settings.localCurrency,
      travelerCount: settings.members.length,
      activities: [],
      updatedAt,
    },
    budget: { emergencyReserveMinor: 0 },
    ledger: { expenses: [], fundContributions: [], payments: [] },
    reservations: (input.reservations ?? []).map(reservation => ({ ...reservation })),
    updatedAt,
  };
}

/** 여행 설정을 바꾸고, 기존 화면이 읽는 일정의 같은 필드(제목·날짜·인원)도 맞춘다. */
export function updateTripSettings(
  trip: TripWorkspace,
  input: TripFormInput,
  now: Date,
): TripWorkspace {
  assertValid(validateTripForm(input, trip));
  const updatedAt = now.toISOString();
  const settings: TripSettings = {
    ...buildSettings(input, assignMemberIds(input.members, trip.settings.members)),
    ownerId: trip.settings.ownerId,
    ...(trip.settings.archived ? { archived: true } : {}),
  };

  return {
    ...trip,
    settings,
    schedule: {
      ...trip.schedule,
      title: settings.title,
      startDate: settings.startDate,
      endDate: settings.endDate,
      travelerCount: settings.members.length,
      timeZone: settings.timeZone,
      currency: settings.localCurrency,
      activities: trip.schedule.activities.map(activity => ({
        ...activity,
        targetAt: zonedIso(activity.targetAt, settings.timeZone),
      })),
      updatedAt,
    },
    updatedAt,
  };
}

/** 저장된 설정을 양식 값으로 되돌린다. */
export function tripFormFromSettings(settings: TripSettings): TripFormInput {
  return {
    title: settings.title,
    destination: settings.destination ?? "",
    timeZone: settings.timeZone,
    localCurrency: settings.localCurrency,
    startDate: settings.startDate,
    endDate: settings.endDate,
    baseCurrency: settings.baseCurrency,
    members: settings.members.map((member) => ({ id: member.id, name: member.name })),
    coverColor: settings.coverColor ?? "cobalt",
  };
}

/** 장부에 한 번이라도 나온 동행자. 이 사람을 지우면 정산이 틀어진다. */
export function referencedMemberIds(ledger: TripLedger): Set<string> {
  const ids = new Set<string>();
  for (const expense of ledger.expenses) {
    if (expense.paidBy.kind === "member") ids.add(expense.paidBy.memberId);
    const splitIds =
      expense.split.kind === "even"
        ? expense.split.memberIds
        : expense.split.shares.map((share) => share.memberId);
    for (const memberId of splitIds) ids.add(memberId);
  }
  for (const contribution of ledger.fundContributions) ids.add(contribution.memberId);
  for (const payment of ledger.payments) {
    ids.add(payment.fromMemberId);
    ids.add(payment.toMemberId);
  }
  return ids;
}

function buildSettings(input: TripFormInput, members: Member[]): TripSettings {
  return {
    title: input.title.trim(),
    ...(input.destination?.trim() ? { destination: input.destination.trim() } : {}),
    startDate: input.startDate,
    endDate: input.endDate,
    timeZone: input.timeZone ?? deviceTimeZone(),
    baseCurrency: input.baseCurrency,
    localCurrency: input.localCurrency ?? input.baseCurrency,
    members,
    ownerId: OWNER_ID,
    coverColor: input.coverColor,
  };
}

// 새 수첩의 첫 사람은 'me', 나머지는 member-1, member-2…로 겹치지 않게 붙인다.
function assignMemberIds(formMembers: TripFormMember[], existing: Member[]): Member[] {
  const used = new Set(existing.map((member) => member.id));
  let next = 1;
  return formMembers.map((member, index) => {
    const name = member.name.trim();
    if (member.id !== undefined) return { id: member.id, name };
    if (index === 0 && existing.length === 0) {
      used.add(OWNER_ID);
      return { id: OWNER_ID, name };
    }
    while (used.has(`member-${next}`)) next += 1;
    const id = `member-${next}`;
    used.add(id);
    return { id, name };
  });
}

function parseDate(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value ? undefined : time;
}

function assertValid(issues: TripFormIssue[]) {
  if (issues.length > 0) {
    throw new RangeError(`Invalid trip form: ${issues.join(", ")}`);
  }
}
