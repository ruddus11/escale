import type {
  LegacyExpense,
  LegacyTripWorkspace,
  TripExpense,
  TripWorkspace,
} from "./types";

/** 형식 1에는 동행자 이름이 없어서, 이 기기 주인을 '나'로 두고 나머지는 자리만 만든다. */
export const LEGACY_OWNER_ID = "me";

/**
 * 저장 형식 1(오사카 여행 하나, 엔화 지출)을 수첩 한 권으로 옮긴다.
 * 형식 1은 엔화만 썼으므로 기준 통화도 엔화로 두어 환율을 지어내지 않는다.
 */
export function upgradeLegacyWorkspace(legacy: LegacyTripWorkspace): TripWorkspace {
  const { schedule } = legacy;
  const companions = Array.from(
    { length: Math.max(schedule.travelerCount - 1, 0) },
    (_, index) => ({ id: `companion-${index + 1}`, name: `동행자 ${index + 1}` }),
  );

  return {
    id: schedule.id,
    settings: {
      title: schedule.title,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      timeZone: schedule.timeZone,
      baseCurrency: "JPY",
      localCurrency: "JPY",
      members: [{ id: LEGACY_OWNER_ID, name: "나" }, ...companions],
      ownerId: LEGACY_OWNER_ID,
    },
    schedule: structuredClone(schedule),
    budget: structuredClone(legacy.budget),
    ledger: {
      expenses: legacy.expenses.map(toOwnerExpense),
      fundContributions: [],
      payments: [],
    },
    ...(legacy.routeSegments === undefined
      ? {}
      : { routeSegments: structuredClone(legacy.routeSegments) }),
    updatedAt: legacy.updatedAt,
  };
}

// 예전 지출은 누가 같이 냈는지 기록이 없어, 정산에 영향이 없도록 '나' 혼자 낸 것으로 옮긴다.
function toOwnerExpense(expense: LegacyExpense): TripExpense {
  return {
    id: expense.id,
    amount: expense.amountMinor,
    currency: "JPY",
    rateToBase: "1",
    paidBy: { kind: "member", memberId: LEGACY_OWNER_ID },
    split: { kind: "even", memberIds: [LEGACY_OWNER_ID] },
    category: expense.category,
    ...(expense.note === undefined ? {} : { note: expense.note }),
    occurredAt: expense.occurredAt,
  };
}
