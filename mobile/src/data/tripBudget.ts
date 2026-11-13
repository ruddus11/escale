import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { convertToBase } from "../../../src/domain/money/currency";

// 예약의 예정 결제액은 장부의 실제 지출과 중복될 수 있어 합산하지 않는다.
export function tripBudgetSummary(trip:TripWorkspace) {
  const total=trip.budget.totalBudgetMinor;
  const spent=trip.ledger.expenses.reduce((sum,item)=>sum+convertToBase(item,trip.settings.baseCurrency),0);
  return {total,spent,remaining:total===undefined ? undefined : total-spent};
}
