import { KeyedError } from "../src/i18n/errors";
import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import type { TripExpense, TripWorkspace } from "../../src/domain/workspace/types";
import { buildSettlementView, canRecordTransfer, recordSettlementPayment } from "../src/data/settlementView";

const make = (names: string[]) =>
  createTrip(
    { title: "Osaka", startDate: "2027-01-01", endDate: "2027-01-04", timeZone: "Asia/Tokyo", baseCurrency: "KRW", localCurrency: "JPY", members: names.map((name) => ({ name })), coverColor: "ink" },
    { id: "settle", now: new Date("2026-12-01T00:00:00Z") },
  );
const expense = (trip: TripWorkspace, part: Partial<TripExpense>): TripExpense => ({
  id: `e${trip.ledger.expenses.length}`,
  amount: 1001,
  currency: "JPY",
  rateToBase: "9",
  category: "food",
  occurredAt: "2027-01-02T03:00:00Z",
  paidBy: { kind: "member", memberId: trip.settings.ownerId },
  split: { kind: "even", memberIds: trip.settings.members.map((m) => m.id) },
  ...part,
});

describe("companion settlement view", () => {
  it("is solo when only the owner travels", () => {
    expect(buildSettlementView(make(["나"])).kind).toBe("solo");
  });

  it("splits 1,001 yen across three people without losing a won and settles to the payer", () => {
    const trip = make(["나", "민지", "준"]);
    trip.ledger.expenses = [expense(trip, {})];
    const view = buildSettlementView(trip);
    if (view.kind !== "group") throw new Error(view.kind);
    expect(view.totalSpent).toBe(9009);
    expect(view.members.reduce((sum, m) => sum + m.share, 0)).toBe(9009);
    expect(view.members.reduce((sum, m) => sum + m.balance, 0)).toBe(0);
    expect(view.transfers.every((t) => t.toName === "나")).toBe(true);
    expect(view.transfers.reduce((sum, t) => sum + t.amount, 0)).toBe(view.members[0].balance);
  });

  it("counts a recorded payment so the same transfer cannot be recorded twice", () => {
    const trip = make(["나", "민지"]);
    trip.ledger.expenses = [expense(trip, { amount: 2000 })];
    const view = buildSettlementView(trip);
    if (view.kind !== "group") throw new Error(view.kind);
    const [transfer] = view.transfers;
    expect(canRecordTransfer(trip, transfer)).toBe(true);
    trip.ledger.payments = [{ id: "p1", fromMemberId: transfer.fromMemberId, toMemberId: transfer.toMemberId, amount: transfer.amount, paidAt: "2027-01-05T00:00:00Z" }];
    const after = buildSettlementView(trip);
    if (after.kind !== "group") throw new Error(after.kind);
    expect(after.transfers).toEqual([]);
    expect(after.payments).toHaveLength(1);
    expect(canRecordTransfer(trip, transfer)).toBe(false);
  });

  it("reports an inconsistent ledger instead of throwing", () => {
    const trip = make(["나", "민지"]);
    trip.ledger.expenses = [expense(trip, { paidBy: { kind: "member", memberId: "gone" } })];
    expect(buildSettlementView(trip).kind).toBe("invalid");
  });
});


describe("settlement payment commit", () => {
  it("rejects a transfer confirmed against an outdated expense total", () => {
    const trip = make(["나", "민지"]);
    trip.ledger.expenses = [expense(trip, { amount: 2000 })];
    const view = buildSettlementView(trip);
    if (view.kind !== "group") throw new Error(view.kind);
    const changed = { ...trip, ledger: { ...trip.ledger, expenses: [expense(trip, { amount: 1000 })] } };
    expect(() => recordSettlementPayment(changed, view.transfers[0], "p1", "2027-01-05T00:00:00Z")).toThrow(KeyedError);
    expect(changed.ledger.payments).toEqual([]);
  });

  it("records once and rejects a duplicate without changing the original trip", () => {
    const trip = make(["나", "민지"]);
    trip.ledger.expenses = [expense(trip, { amount: 2000 })];
    const view = buildSettlementView(trip);
    if (view.kind !== "group") throw new Error(view.kind);
    const next = recordSettlementPayment(trip, view.transfers[0], "p1", "2027-01-05T00:00:00Z");
    expect(trip.ledger.payments).toEqual([]);
    expect(next.ledger.payments).toHaveLength(1);
    expect(buildSettlementView(next)).toMatchObject({ transfers: [] });
    expect(() => recordSettlementPayment(next, view.transfers[0], "p2", "2027-01-05T00:00:01Z")).toThrow(KeyedError);
  });
});
