import { describe, expect, it } from "vitest";
import { createTrip, tripFormFromSettings, updateTripSettings, validateTripForm } from "./tripForm";
import { createTripLibrary, emptyTripLibrary, removeTrip } from "./library";
import { parseTripLibrary } from "../../repositories/tripRepository";
import { osakaLibrarySeed } from "../../data/scheduleSeed";
import { createActivityDraft, saveActivityDraft } from "../../features/schedule/activityDraft";
import { calculateBudget } from "../budget/calculateBudget";
import { convertToBase, parseMoney, moneyInput, formatMoney } from "../money/currency";
const now = new Date("2026-07-01T00:00:00Z");
function paris() { return createTrip({ title: "여름 여행", destination: "파리", startDate: "2026-07-01", endDate: "2026-07-05", timeZone: "Europe/Paris", localCurrency: "EUR", baseCurrency: "KRW", members: [{ name: "나" }], coverColor: "cobalt" }, { id: "paris", now }); }
describe("국가에 종속되지 않는 여행", () => {
 it("형식 2의 엔화 예산을 다른 정산 통화로 재해석하지 않는다", () => {
  const old = JSON.parse(JSON.stringify(osakaLibrarySeed)
   .replaceAll("BudgetMinor", "BudgetYen").replaceAll("ReserveMinor", "ReserveYen")
   .replaceAll("PerPersonMinor", "PerPersonYen").replaceAll("CostMinor", "CostYen"));
  old.schemaVersion = 2;
  old.trips[0].settings.baseCurrency = "USD";
  const migrated = parseTripLibrary(old).trips[0]!;
  expect(migrated.budget).toEqual({ emergencyReserveMinor: 0 });
  expect(migrated).toHaveProperty("legacyYenBudget", osakaLibrarySeed.trips[0]!.budget);
  expect(parseTripLibrary(createTripLibrary(migrated)).trips[0]).toEqual(migrated);
 });
 it("실재하지 않는 날짜가 있는 백업을 화면에 반영하기 전에 거부한다", () => {
  const trip = paris();
  trip.settings.startDate = "2026-02-30";
  trip.schedule.startDate = "2026-02-30";
  expect(() => parseTripLibrary(createTripLibrary(trip))).toThrow();
 });
 it("일정의 예상 비용은 저장소의 금액 한도를 넘지 못한다", () => {
  const trip = paris();
  const draft = { ...createActivityDraft(undefined, "2026-07-01"), title: "비용", estimatedCostMinor: "100000.01" };
  expect(() => saveActivityDraft(draft, trip.schedule)).toThrow();
 });
 it("UTC 백업 일정의 예정 비용을 여행지 현지 날짜로 묶는다", () => {
  const trip = paris();
  trip.schedule.activities.push({ ...saveActivityDraft({ ...createActivityDraft(undefined, "2026-07-02"), title: "심야 도착", estimatedCostMinor: "10" }, trip.schedule), targetAt: "2026-07-01T23:00:00Z" });
  expect(calculateBudget(trip).plannedCostByDate).toEqual([{ date: "2026-07-02", amountMinor: 1000, missing: 0 }]);
 });
 it("파리 일정 시각과 센트 비용을 저장하고 백업에서 복원한다", () => {
  const trip = paris();
  const draft = createActivityDraft(undefined, "2026-07-01", trip.settings.timeZone, trip.settings.localCurrency);
  trip.schedule.activities.push(saveActivityDraft({ ...draft, title: "점심", time: "12:30", estimatedCostMinor: "12.34" }, trip.schedule));
  expect(trip.schedule.activities[0]?.targetAt).toBe("2026-07-01T12:30:00+02:00");
  expect(trip.schedule.activities[0]?.estimatedCostMinor).toBe(1234);
  const restored = parseTripLibrary(JSON.parse(JSON.stringify(createTripLibrary(trip))));
  expect(restored.trips[0]).toEqual(trip);
 });
 it("서로 다른 통화를 입력 당시 환율로 합산한다", () => {
  const trip = paris();
  trip.ledger.expenses.push({ id: "lunch", amount: 1234, currency: "EUR", rateToBase: "1500", paidBy: { kind: "member", memberId: "me" }, split: { kind: "even", memberIds: ["me"] }, category: "food", occurredAt: "2026-07-01T12:00:00+02:00" });
  trip.ledger.expenses.push({ ...trip.ledger.expenses[0]!, id: "water", currency: "KRW", amount: 2000, rateToBase: "1" });
  expect(calculateBudget(trip).spentMinor).toBe(20510);
  expect(validateTripForm({ ...tripFormFromSettings(trip.settings), baseCurrency: "USD" }, trip)).toContain("currency-in-use");
 });
 it("시간대를 바꿔도 기존 일정의 순간은 보존한다", () => {
  const trip = paris();
  trip.schedule.activities.push(saveActivityDraft({ ...createActivityDraft(undefined, "2026-07-02"), title: "예약", time: "12:00" }, trip.schedule));
  const updated = updateTripSettings(trip, { ...tripFormFromSettings(trip.settings), timeZone: "America/New_York" }, now);
  expect(updated.schedule.activities[0]?.targetAt).toBe("2026-07-02T06:00:00-04:00");
  expect(Date.parse(updated.schedule.activities[0]!.targetAt)).toBe(Date.parse(trip.schedule.activities[0]!.targetAt));
 });
 it("실제 예전 엔화 키와 형식 2를 값 손실 없이 이전한다", () => {
  const old = JSON.parse(JSON.stringify(osakaLibrarySeed).replaceAll("totalBudgetMinor", "totalBudgetYen").replaceAll("emergencyReserveMinor", "emergencyReserveYen").replaceAll("mealBudgetPerPersonMinor", "mealBudgetPerPersonYen").replaceAll("estimatedCostMinor", "estimatedCostYen"));
  old.schemaVersion = 2;
  expect(parseTripLibrary(old)).toEqual(osakaLibrarySeed);
  expect(old.schemaVersion).toBe(2);
  expect(old.trips[0].budget).toHaveProperty("emergencyReserveYen");
 });
 it("형식 1의 실제 엔화 키도 금액과 환율을 바꾸지 않고 이전한다", () => {
  const schedule = JSON.parse(JSON.stringify(osakaLibrarySeed.trips[0]!.schedule).replaceAll("estimatedCostMinor", "estimatedCostYen"));
  const old = { schemaVersion: 1, schedule, budget: { emergencyReserveYen: 5000 }, expenses: [{ id: "old-lunch", amountYen: 1234, category: "food", occurredAt: "2026-07-20T12:00:00+09:00" }], updatedAt: now.toISOString() };
  const trip = parseTripLibrary(old).trips[0]!;
  expect(trip.budget.emergencyReserveMinor).toBe(5000);
  expect(trip.ledger.expenses[0]).toMatchObject({ amount: 1234, currency: "JPY", rateToBase: "1" });
  expect(old.expenses[0]).toHaveProperty("amountYen", 1234);
 });
 it("빈 목록과 마지막 수첩 삭제 결과를 백업할 수 있다", () => {
  expect(parseTripLibrary(emptyTripLibrary()).trips).toEqual([]);
  const library = removeTrip(createTripLibrary(paris()), "paris", now.toISOString());
  expect(parseTripLibrary(library).activeTripId).toBe("");
 });
 it("0·2·3자리 통화와 최대 금액을 정확히 처리한다", () => {
  expect(parseMoney("12.34", "EUR")).toBe(1234);
  expect(parseMoney("12.345", "KWD")).toBe(12345);
  expect(parseMoney("12.1", "KRW")).toBeUndefined();
  expect(parseMoney("12.345", "USD")).toBeUndefined();
  expect(parseMoney("1000000000001", "JPY")).toBeUndefined();
  expect(moneyInput(1234, "EUR")).toBe("12.34");
  expect(formatMoney(12345, "KWD")).toContain("12.345");
  expect(convertToBase({ amount: 12345, currency: "KWD", rateToBase: "3.25" }, "USD")).toBe(4012);
 });
});
