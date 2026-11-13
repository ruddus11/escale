import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import { calculateBudget } from "./calculateBudget";

describe("calculateBudget", () => {
  it("총예산이 없으면 사용 가능액을 추정하지 않는다", () => {
    const workspace = structuredClone(osakaWorkspaceSeed);
    delete workspace.budget.totalBudgetMinor;
    const result = calculateBudget(workspace);

    expect(result.totalBudgetMinor).toBeUndefined();
    expect(result.availableMinor).toBeUndefined();
    expect(result.spentMinor).toBe(0);
  });

  it("혼합 통화 지출의 환산액과 비상금을 빼고 초과액을 음수로 보존한다", () => {
    const workspace = structuredClone(osakaWorkspaceSeed);
    workspace.budget.totalBudgetMinor = 3_000;
    workspace.budget.emergencyReserveMinor = 1_000;
    workspace.ledger.expenses = [
      {
        id: "one",
        amount: 2_500,
        currency: "JPY",
        rateToBase: "1",
        paidBy: { kind: "member", memberId: "me" },
        split: { kind: "even", memberIds: ["me"] },
        category: "food",
        occurredAt: "2026-07-20T13:00:00+09:00",
      },
      {
        id: "souvenir-won",
        amount: 30_000,
        currency: "KRW",
        rateToBase: "0.1096",
        paidBy: { kind: "member", memberId: "me" },
        split: { kind: "even", memberIds: ["me"] },
        category: "shopping",
        occurredAt: "2026-07-20T15:00:00+09:00",
      },
    ];

    expect(calculateBudget(workspace).availableMinor).toBe(-3788);
  });

  it("일정의 입력된 예정 비용과 미입력 개수를 별도로 계산한다", () => {
    const workspace = structuredClone(osakaWorkspaceSeed);
    workspace.schedule.activities[0]!.estimatedCostMinor = 2_700;
    workspace.schedule.activities[1]!.estimatedCostMinor = 1_200;

    const result = calculateBudget(workspace);

    expect(result.plannedCostMinor).toBe(3_900);
    expect(result.activitiesMissingCost).toBe(
      workspace.schedule.activities.length - 2,
    );
  });
});
