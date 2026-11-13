import { describe, expect, it } from "vitest";
import { osakaLibrarySeed } from "../data/scheduleSeed";
import type { TripLibrary, TripWorkspace } from "../domain/workspace/types";
import { isTripLibrary } from "./tripLibrarySchema";

function autumnTrip(): TripWorkspace {
  const seedTrip = structuredClone(osakaLibrarySeed.trips[0]!);
  return {
    ...seedTrip,
    id: "autumn-2026",
    settings: {
      title: "가을 여행",
      startDate: "2026-10-12",
      endDate: "2026-10-16",
      timeZone: "Asia/Tokyo",
      baseCurrency: "KRW",
      localCurrency: "JPY",
      members: [
        { id: "me", name: "나" },
        { id: "minji", name: "민지" },
        { id: "junho", name: "준호" },
      ],
      ownerId: "me",
    },
    ledger: {
      expenses: [
        {
          id: "lunch",
          amount: 4_600,
          currency: "JPY",
          rateToBase: "9.1304",
          paidBy: { kind: "member", memberId: "minji" },
          split: { kind: "even", memberIds: ["me", "minji", "junho"] },
          title: "점심",
          category: "food",
          method: "card",
          occurredAt: "2026-10-14T12:30:00+09:00",
        },
        {
          id: "bus-pass",
          amount: 2_100,
          currency: "JPY",
          rateToBase: "9.1304",
          paidBy: { kind: "fund" },
          split: {
            kind: "custom",
            shares: [
              { memberId: "me", amount: 700 },
              { memberId: "minji", amount: 700 },
              { memberId: "junho", amount: 700 },
            ],
          },
          category: "transport",
          method: "cash",
          note: "1일권 3장",
          occurredAt: "2026-10-13T09:00:00+09:00",
        },
      ],
      fundContributions: [
        {
          id: "fund-me",
          memberId: "me",
          amount: 5_000,
          currency: "JPY",
          rateToBase: "9.1304",
          occurredAt: "2026-10-12T20:00:00+09:00",
        },
      ],
      payments: [
        {
          id: "paid-1",
          fromMemberId: "junho",
          toMemberId: "minji",
          amount: 10_000,
          paidAt: "2026-10-16T21:00:00+09:00",
        },
      ],
    },
  };
}

function library(trip: TripWorkspace = autumnTrip()): TripLibrary {
  return {
    schemaVersion: 3,
    activeTripId: trip.id,
    trips: [structuredClone(osakaLibrarySeed.trips[0]!), trip],
    updatedAt: "2026-10-16T21:00:00.000Z",
  };
}

describe("isTripLibrary", () => {
  it("수첩 여러 권과 공금·사람별 금액·보냄 기록이 있는 장부를 받는다", () => {
    expect(isTripLibrary(library())).toBe(true);
    expect(isTripLibrary(osakaLibrarySeed)).toBe(true);
  });

  it.each<[string, (value: TripLibrary) => void]>([
    ["형식 번호가 다름", (value) => Object.assign(value, { schemaVersion: 99 })],
    ["모르는 최상위 키", (value) => Object.assign(value, { accessCode: "secret" })],
    ["펼친 수첩이 목록에 없음", (value) => Object.assign(value, { activeTripId: "ghost" })],
    ["수첩 id 중복", (value) => value.trips.push(structuredClone(value.trips[1]!))],
    ["수첩이 한 권도 없음", (value) => Object.assign(value, { trips: [] })],
    ["시간대 이름이 틀림", (value) => Object.assign(value.trips[1]!.settings, { timeZone: "Mars/Olympus" })],
    ["지원하지 않는 통화", (value) => Object.assign(value.trips[1]!.settings, { localCurrency: "ZZZ" })],
    ["총무가 동행자가 아님", (value) => Object.assign(value.trips[1]!.settings, { ownerId: "ghost" })],
    ["동행자 id 중복", (value) => value.trips[1]!.settings.members.push({ id: "me", name: "나2" })],
    ["시작일이 종료일보다 늦음", (value) => Object.assign(value.trips[1]!.settings, { startDate: "2026-10-20" })],
    ["지출에 모르는 키", (value) => Object.assign(value.trips[1]!.ledger.expenses[0]!, { bookingNumber: "4821" })],
    ["지출 분류가 틀림", (value) => Object.assign(value.trips[1]!.ledger.expenses[0]!, { category: "gift" })],
    ["결제 수단이 틀림", (value) => Object.assign(value.trips[1]!.ledger.expenses[0]!, { method: "points" })],
    ["지출 id 중복", (value) => value.trips[1]!.ledger.expenses.push(structuredClone(value.trips[1]!.ledger.expenses[0]!))],
    ["환율 형식이 틀림", (value) => Object.assign(value.trips[1]!.ledger.expenses[0]!, { rateToBase: "9,13" })],
    ["사람별 금액 합이 다름", (value) => Object.assign(value.trips[1]!.ledger.expenses[1]!.split, { shares: [{ memberId: "me", amount: 700 }] })],
    ["모르는 사람이 결제", (value) => Object.assign(value.trips[1]!.ledger.expenses[0]!, { paidBy: { kind: "member", memberId: "ghost" } })],
    ["자기에게 보냄", (value) => Object.assign(value.trips[1]!.ledger.payments[0]!, { toMemberId: "junho" })],
    ["보낸 시각이 없음", (value) => Object.assign(value.trips[1]!.ledger.payments[0]!, { paidAt: "어제" })],
  ])("%s이면 거부한다", (_name, breakIt) => {
    const value = library();
    breakIt(value);
    expect(isTripLibrary(value)).toBe(false);
  });
});
