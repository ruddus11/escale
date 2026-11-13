import { describe, expect, it } from "vitest";
import { validateLedger } from "../money/validateLedger";
import { toMoneyLedger } from "./tripLedger";
import type { LegacyTripWorkspace } from "./types";
import { upgradeLegacyWorkspace } from "./upgradeLegacyWorkspace";

function legacyWorkspace(): LegacyTripWorkspace {
  return {
    schemaVersion: 1,
    schedule: {
      id: "osaka-2026",
      schemaVersion: 1,
      seedVersion: 2,
      title: "오사카·교토 4박 5일",
      startDate: "2026-07-20",
      endDate: "2026-07-24",
      timeZone: "Asia/Tokyo",
      currency: "JPY",
      travelerCount: 3,
      activities: [],
      updatedAt: "2026-07-19T10:00:00.000Z",
    },
    budget: { totalBudgetMinor: 35_000, emergencyReserveMinor: 5_000 },
    expenses: [
      {
        id: "takoyaki",
        amountMinor: 800,
        category: "food",
        note: "도톤보리",
        occurredAt: "2026-07-20T19:00:00+09:00",
      },
      {
        id: "icoca",
        amountMinor: 2_000,
        category: "transport",
        occurredAt: "2026-07-20T14:00:00+09:00",
      },
    ],
    routeSegments: [
      {
        originActivityId: "a",
        destinationActivityId: "b",
        departureBasis: "plan",
        options: [],
        fetchedAt: "2026-07-20T10:00:00.000Z",
      },
    ],
    updatedAt: "2026-07-21T09:00:00.000Z",
  };
}

describe("upgradeLegacyWorkspace", () => {
  it("일정 정보로 여행 설정을 만들고 동행자 수만큼 자리를 둔다", () => {
    const trip = upgradeLegacyWorkspace(legacyWorkspace());

    expect(trip.id).toBe("osaka-2026");
    expect(trip.settings).toEqual({
      title: "오사카·교토 4박 5일",
      startDate: "2026-07-20",
      endDate: "2026-07-24",
      timeZone: "Asia/Tokyo",
      baseCurrency: "JPY",
      localCurrency: "JPY",
      members: [
        { id: "me", name: "나" },
        { id: "companion-1", name: "동행자 1" },
        { id: "companion-2", name: "동행자 2" },
      ],
      ownerId: "me",
    });
  });

  it("엔화 지출을 환율 없이 '나' 혼자 낸 지출로 옮긴다", () => {
    const trip = upgradeLegacyWorkspace(legacyWorkspace());

    expect(trip.ledger.expenses).toEqual([
      {
        id: "takoyaki",
        amount: 800,
        currency: "JPY",
        rateToBase: "1",
        paidBy: { kind: "member", memberId: "me" },
        split: { kind: "even", memberIds: ["me"] },
        category: "food",
        note: "도톤보리",
        occurredAt: "2026-07-20T19:00:00+09:00",
      },
      {
        id: "icoca",
        amount: 2_000,
        currency: "JPY",
        rateToBase: "1",
        paidBy: { kind: "member", memberId: "me" },
        split: { kind: "even", memberIds: ["me"] },
        category: "transport",
        occurredAt: "2026-07-20T14:00:00+09:00",
      },
    ]);
    expect(trip.ledger.fundContributions).toEqual([]);
    expect(trip.ledger.payments).toEqual([]);
    expect(validateLedger(toMoneyLedger(trip))).toEqual([]);
  });

  it("일정·예산·경로 캐시·갱신 시각은 그대로 둔다", () => {
    const legacy = legacyWorkspace();
    const trip = upgradeLegacyWorkspace(legacy);

    expect(trip.schedule).toEqual(legacy.schedule);
    expect(trip.budget).toEqual(legacy.budget);
    expect(trip.routeSegments).toEqual(legacy.routeSegments);
    expect(trip.updatedAt).toBe(legacy.updatedAt);
    expect(trip.schedule).not.toBe(legacy.schedule);
  });

  it("경로 캐시가 없던 형식 1에는 routeSegments 키를 만들지 않는다", () => {
    const legacy = legacyWorkspace();
    delete legacy.routeSegments;

    expect("routeSegments" in upgradeLegacyWorkspace(legacy)).toBe(false);
  });
});
