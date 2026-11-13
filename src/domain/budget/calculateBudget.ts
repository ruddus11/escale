import { convertToBase } from "../money/currency";
import { zonedDate } from "../time/zoned";
import type { TripWorkspace } from "../workspace/types";

export interface BudgetSummary {
  totalBudgetMinor?: number;
  emergencyReserveMinor: number;
  spentMinor: number;
  availableMinor?: number;
  plannedCostMinor: number;
  activitiesMissingCost: number;
  plannedCostByDate: Array<{ date: string; amountMinor: number; missing: number }>;
}

export function calculateBudget(workspace: TripWorkspace): BudgetSummary {
  // 장부의 입력 당시 환율로 기준 통화 합계를 계산한다.
  const spentMinor = workspace.ledger.expenses
    .reduce((total, expense) => total + convertToBase(expense, workspace.settings.baseCurrency), 0);
  const plannedCostByDate = new Map<string, { amountMinor: number; missing: number }>();

  for (const activity of workspace.schedule.activities) {
    const date = zonedDate(activity.targetAt, workspace.settings.timeZone);
    const current = plannedCostByDate.get(date) ?? { amountMinor: 0, missing: 0 };
    if (activity.estimatedCostMinor === undefined) {
      current.missing += 1;
    } else {
      current.amountMinor += activity.estimatedCostMinor;
    }
    plannedCostByDate.set(date, current);
  }

  const totalBudgetMinor = workspace.budget.totalBudgetMinor;
  return {
    ...(totalBudgetMinor === undefined ? {} : { totalBudgetMinor }),
    emergencyReserveMinor: workspace.budget.emergencyReserveMinor,
    spentMinor,
    ...(totalBudgetMinor === undefined
      ? {}
      : {
          availableMinor:
            totalBudgetMinor - spentMinor - workspace.budget.emergencyReserveMinor,
        }),
    plannedCostMinor: [...plannedCostByDate.values()].reduce(
      (total, day) => total + day.amountMinor,
      0,
    ),
    activitiesMissingCost: [...plannedCostByDate.values()].reduce(
      (total, day) => total + day.missing,
      0,
    ),
    plannedCostByDate: [...plannedCostByDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => ({ date, ...value })),
  };
}
