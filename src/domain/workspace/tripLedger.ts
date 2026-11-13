import type { MoneyLedger } from "../money/types";
import type {
  ExpenseCategory,
  TripExpense,
  TripSettings,
  TripWorkspace,
} from "./types";

/** 수첩 장부를 돈 계산 엔진 입력으로 바꾼다. 남은 공금은 총무가 들고 있는 것으로 계산한다. */
export function toMoneyLedger(
  trip: Pick<TripWorkspace, "settings" | "ledger">,
): MoneyLedger {
  return {
    baseCurrency: trip.settings.baseCurrency,
    members: trip.settings.members,
    fundHolderId: trip.settings.ownerId,
    expenses: trip.ledger.expenses,
    fundContributions: trip.ledger.fundContributions,
    payments: trip.ledger.payments,
  };
}

export interface OwnerExpenseInput {
  id: string;
  /** 기준 통화의 최소 단위 정수 */
  amount: number;
  category: ExpenseCategory;
  note?: string;
  occurredAt: string;
}

/**
 * 결제자와 나눌 사람을 묻지 않는 입력(예산 화면)용 지출.
 * 총무 혼자 기준 통화로 냈다고 기록해서 정산 금액에 영향을 주지 않는다.
 */
export function createOwnerExpense(
  settings: Pick<TripSettings, "baseCurrency" | "ownerId">,
  input: OwnerExpenseInput,
): TripExpense {
  return {
    id: input.id,
    amount: input.amount,
    currency: settings.baseCurrency,
    rateToBase: "1",
    paidBy: { kind: "member", memberId: settings.ownerId },
    split: { kind: "even", memberIds: [settings.ownerId] },
    category: input.category,
    ...(input.note === undefined ? {} : { note: input.note }),
    occurredAt: input.occurredAt,
  };
}
