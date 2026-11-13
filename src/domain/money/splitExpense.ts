import { allocateByWeights } from "./allocate";
import { convertToBase } from "./currency";
import type { LedgerExpense, MoneyLedger } from "./types";
import { MoneyLedgerError, validateExpense } from "./validateLedger";

export interface ExpenseShare {
  memberId: string;
  /** 지출 통화 최소 단위 */
  amount: number;
  /** 기준 통화 최소 단위 */
  baseAmount: number;
}

/**
 * 지출 한 건의 사람별 몫을 동행자 목록 순서로 돌려준다.
 * 몫의 합은 지출 금액, 그리고 기준 통화로 바꾼 금액과 정확히 같다.
 */
export function splitExpense(
  expense: LedgerExpense,
  context: Pick<MoneyLedger, "baseCurrency" | "members">,
): ExpenseShare[] {
  const issues = validateExpense(expense, context);
  if (issues.length > 0) {
    throw new MoneyLedgerError(issues);
  }

  const weightByMember = new Map<string, number>(
    expense.split.kind === "even"
      ? expense.split.memberIds.map((memberId): [string, number] => [memberId, 1])
      : expense.split.shares.map((share): [string, number] => [
          share.memberId,
          share.amount,
        ]),
  );
  const participants = context.members.flatMap((member) => {
    const weight = weightByMember.get(member.id);
    return weight === undefined ? [] : [{ memberId: member.id, weight }];
  });

  const weights = participants.map((participant) => participant.weight);
  const amounts =
    expense.split.kind === "even"
      ? allocateByWeights(expense.amount, weights)
      : weights;
  const baseAmounts = allocateByWeights(
    convertToBase(expense, context.baseCurrency),
    weights,
  );

  return participants.map((participant, index) => ({
    memberId: participant.memberId,
    amount: amounts[index],
    baseAmount: baseAmounts[index],
  }));
}
