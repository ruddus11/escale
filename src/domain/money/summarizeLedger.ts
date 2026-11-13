import { convertToBase } from "./currency";
import { splitExpense } from "./splitExpense";
import type { CurrencyCode, MoneyLedger } from "./types";
import { MoneyLedgerError, validateLedger } from "./validateLedger";

/** 모든 금액은 기준 통화 최소 단위 */
export interface MemberMoneySummary {
  memberId: string;
  /** 직접 낸 지출 */
  paid: number;
  /** 공금에 낸 돈 */
  contributed: number;
  /** 내 몫 */
  share: number;
  /** 들고 있는 남은 공금. 보관자만 있고, 공금이 모자라 메웠으면 음수 */
  fundHeld: number;
  /** 보냄 표시한 돈 */
  sent: number;
  /** 받은 것으로 표시된 돈 */
  received: number;
  /** + 받을 돈, − 보낼 돈 */
  balance: number;
}

export interface FundSummary {
  contributed: number;
  spent: number;
  remaining: number;
}

export interface LedgerSummary {
  baseCurrency: CurrencyCode;
  expenseCount: number;
  totalSpent: number;
  fund: FundSummary;
  members: MemberMoneySummary[];
}

type MemberTotals = Pick<
  MemberMoneySummary,
  "paid" | "contributed" | "share" | "sent" | "received"
>;

/** 장부를 사람별 낸 돈·내 몫·차액과 공금으로 정리한다. 차액의 합은 항상 0이다. */
export function summarizeLedger(ledger: MoneyLedger): LedgerSummary {
  const issues = validateLedger(ledger);
  if (issues.length > 0) {
    throw new MoneyLedgerError(issues);
  }

  const totals = new Map<string, MemberTotals>(
    ledger.members.map((member) => [
      member.id,
      { paid: 0, contributed: 0, share: 0, sent: 0, received: 0 },
    ]),
  );
  const totalsOf = (memberId: string): MemberTotals => {
    const memberTotals = totals.get(memberId);
    if (memberTotals === undefined) {
      throw new MoneyLedgerError([{ code: "unknown-member", memberId }]);
    }
    return memberTotals;
  };

  let totalSpent = 0;
  let fundSpent = 0;
  for (const expense of ledger.expenses) {
    const shares = splitExpense(expense, ledger);
    const amount = shares.reduce((sum, share) => sum + share.baseAmount, 0);
    totalSpent += amount;
    if (expense.paidBy.kind === "fund") {
      fundSpent += amount;
    } else {
      totalsOf(expense.paidBy.memberId).paid += amount;
    }
    for (const share of shares) {
      totalsOf(share.memberId).share += share.baseAmount;
    }
  }

  let fundContributed = 0;
  for (const contribution of ledger.fundContributions) {
    const amount = convertToBase(contribution, ledger.baseCurrency);
    fundContributed += amount;
    totalsOf(contribution.memberId).contributed += amount;
  }

  for (const payment of ledger.payments) {
    totalsOf(payment.fromMemberId).sent += payment.amount;
    totalsOf(payment.toMemberId).received += payment.amount;
  }

  const fundRemaining = fundContributed - fundSpent;
  return {
    baseCurrency: ledger.baseCurrency,
    expenseCount: ledger.expenses.length,
    totalSpent,
    fund: { contributed: fundContributed, spent: fundSpent, remaining: fundRemaining },
    members: ledger.members.map((member) => {
      const { paid, contributed, share, sent, received } = totalsOf(member.id);
      const fundHeld = member.id === ledger.fundHolderId ? fundRemaining : 0;
      return {
        memberId: member.id,
        paid,
        contributed,
        share,
        fundHeld,
        sent,
        received,
        balance: paid + contributed - share - fundHeld + sent - received,
      };
    }),
  };
}
