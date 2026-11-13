import { isReservationList } from "../domain/reservations/reservations";
import { isCurrencyCode } from "../domain/money/currency";
import { isTimeZone } from "../domain/time/zoned";
import type { Member } from "../domain/money/types";
import { validateLedger } from "../domain/money/validateLedger";
import { toMoneyLedger } from "../domain/workspace/tripLedger";
import type {
  TripExpense,
  TripFundContribution,
  TripLedger,
  TripLibrary,
  TripPayment,
  TripSettings,
  TripWorkspace,
} from "../domain/workspace/types";
import {
  isDateOnly,
  isIsoDateTime,
  isNonEmptyString,
  isRecordWithOnlyKeys,
} from "./schemaGuards";
import {
  isBudgetSettings,
  isOptionalRouteSegments,
  isSchedulePlan,
} from "./workspaceSchema";

const expenseCategories = ["transport", "food", "drink", "admission", "shopping", "other"];

/** 저장 형식 3 전체를 확인한다. 장부 내용은 돈 계산 엔진의 검사를 그대로 쓴다. */
export function isTripLibrary(value: unknown): value is TripLibrary {
  if (
    !isRecordWithOnlyKeys(value, ["schemaVersion", "activeTripId", "trips", "updatedAt"]) ||
    value.schemaVersion !== 3 ||
    !Array.isArray(value.trips) ||
    value.trips.length > 50 ||
    !isIsoDateTime(value.updatedAt)
  ) {
    return false;
  }

  const trips: unknown[] = value.trips;
  if (!trips.every(isTripWorkspace)) return false;
  const tripIds = trips.map((trip) => trip.id);
  return (
    new Set(tripIds).size === tripIds.length &&
    typeof value.activeTripId === "string" &&
    (tripIds.length === 0 ? value.activeTripId === "" : tripIds.includes(value.activeTripId))
  );
}

function isTripWorkspace(value: unknown): value is TripWorkspace {
  return (
    isRecordWithOnlyKeys(value, [
      "id",
      "settings",
      "schedule",
      "budget",
      "legacyYenBudget",
      "ledger",
      "routeSegments",
      "reservations",
      "updatedAt",
    ]) &&
    isNonEmptyString(value.id, 80) &&
    isTripSettings(value.settings) &&
    isSchedulePlan(value.schedule) &&
    isBudgetSettings(value.budget) &&
    (value.legacyYenBudget === undefined || isBudgetSettings(value.legacyYenBudget)) &&
    isTripLedger(value.ledger) &&
    (value.reservations === undefined || isReservationList(value.reservations)) &&
    isOptionalRouteSegments(value.routeSegments) &&
    isIsoDateTime(value.updatedAt) &&
    validateLedger(toMoneyLedger({ settings: value.settings, ledger: value.ledger }))
      .length === 0
  );
}

function isTripSettings(value: unknown): value is TripSettings {
  if (
    !isRecordWithOnlyKeys(value, [
      "title",
      "destination",
      "startDate",
      "endDate",
      "timeZone",
      "baseCurrency",
      "localCurrency",
      "members",
      "ownerId",
      "coverColor",
      "archived",
    ]) ||
    !isNonEmptyString(value.title, 120) ||
    !(value.destination === undefined || isNonEmptyString(value.destination, 120)) ||
    !isDateOnly(value.startDate) ||
    !isDateOnly(value.endDate) ||
    value.startDate > value.endDate ||
    !isTimeZone(value.timeZone) ||
    !isCurrencyCode(value.baseCurrency) ||
    !isCurrencyCode(value.localCurrency) ||
    !Array.isArray(value.members) ||
    value.members.length < 1 ||
    value.members.length > 20 ||
    !(value.coverColor === undefined || ["cobalt", "ink", "sky"].includes(String(value.coverColor))) ||
    !(value.archived === undefined || typeof value.archived === "boolean")
  ) {
    return false;
  }

  const members: unknown[] = value.members;
  if (!members.every(isMember)) return false;
  const memberIds = members.map((member) => member.id);
  return (
    new Set(memberIds).size === memberIds.length &&
    typeof value.ownerId === "string" &&
    memberIds.includes(value.ownerId)
  );
}

function isMember(value: unknown): value is Member {
  return (
    isRecordWithOnlyKeys(value, ["id", "name"]) &&
    isNonEmptyString(value.id, 80) &&
    isNonEmptyString(value.name, 40)
  );
}

function isTripLedger(value: unknown): value is TripLedger {
  return (
    isRecordWithOnlyKeys(value, ["expenses", "fundContributions", "payments"]) &&
    isUniqueList(value.expenses, 2_000, isTripExpense) &&
    isUniqueList(value.fundContributions, 500, isTripFundContribution) &&
    isUniqueList(value.payments, 500, isTripPayment)
  );
}

function isUniqueList<T extends { id: string }>(
  value: unknown,
  maxLength: number,
  isItem: (item: unknown) => item is T,
): value is T[] {
  if (!Array.isArray(value) || value.length > maxLength) return false;
  const items: unknown[] = value;
  if (!items.every(isItem)) return false;
  return new Set(items.map((item) => item.id)).size === items.length;
}

// 금액·통화·환율·사람의 내용은 validateLedger가 보고, 여기서는 모양만 확인한다.
function isTripExpense(value: unknown): value is TripExpense {
  return (
    isRecordWithOnlyKeys(value, [
      "id",
      "amount",
      "currency",
      "rateToBase",
      "paidBy",
      "split",
      "title",
      "category",
      "method",
      "note",
      "occurredAt",
    ]) &&
    isNonEmptyString(value.id, 120) &&
    typeof value.amount === "number" &&
    typeof value.currency === "string" &&
    typeof value.rateToBase === "string" &&
    isExpensePayer(value.paidBy) &&
    isExpenseSplit(value.split) &&
    (value.title === undefined || isNonEmptyString(value.title, 60)) &&
    expenseCategories.includes(String(value.category)) &&
    (value.method === undefined || value.method === "card" || value.method === "cash") &&
    (value.note === undefined ||
      (typeof value.note === "string" && value.note.length <= 200)) &&
    isIsoDateTime(value.occurredAt)
  );
}

function isExpensePayer(value: unknown): boolean {
  return (
    (isRecordWithOnlyKeys(value, ["kind"]) && value.kind === "fund") ||
    (isRecordWithOnlyKeys(value, ["kind", "memberId"]) &&
      value.kind === "member" &&
      typeof value.memberId === "string")
  );
}

function isExpenseSplit(value: unknown): boolean {
  if (isRecordWithOnlyKeys(value, ["kind", "memberIds"]) && value.kind === "even") {
    return (
      Array.isArray(value.memberIds) &&
      value.memberIds.length <= 20 &&
      value.memberIds.every((memberId) => typeof memberId === "string")
    );
  }
  if (isRecordWithOnlyKeys(value, ["kind", "shares"]) && value.kind === "custom") {
    return (
      Array.isArray(value.shares) &&
      value.shares.length <= 20 &&
      value.shares.every(
        (share) =>
          isRecordWithOnlyKeys(share, ["memberId", "amount"]) &&
          typeof share.memberId === "string" &&
          typeof share.amount === "number",
      )
    );
  }
  return false;
}

function isTripFundContribution(value: unknown): value is TripFundContribution {
  return (
    isRecordWithOnlyKeys(value, [
      "id",
      "memberId",
      "amount",
      "currency",
      "rateToBase",
      "occurredAt",
    ]) &&
    isNonEmptyString(value.id, 120) &&
    typeof value.memberId === "string" &&
    typeof value.amount === "number" &&
    typeof value.currency === "string" &&
    typeof value.rateToBase === "string" &&
    isIsoDateTime(value.occurredAt)
  );
}

function isTripPayment(value: unknown): value is TripPayment {
  return (
    isRecordWithOnlyKeys(value, ["id", "fromMemberId", "toMemberId", "amount", "paidAt"]) &&
    isNonEmptyString(value.id, 120) &&
    typeof value.fromMemberId === "string" &&
    typeof value.toMemberId === "string" &&
    typeof value.amount === "number" &&
    isIsoDateTime(value.paidAt)
  );
}
