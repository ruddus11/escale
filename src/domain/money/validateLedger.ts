import { convertToBase, isCurrencyCode, parseRate } from "./currency";
import type {
  ConvertibleAmount,
  CurrencyCode,
  LedgerExpense,
  MoneyLedger,
} from "./types";

/** 항목 하나의 입력·환산 금액 상한: 원·엔·센트 기준 1조. 장부 전체 합계의 상한은 아니다. */
export const MAX_MINOR_AMOUNT = 1_000_000_000_000;

export type LedgerIssueCode =
  | "duplicate-member"
  | "unknown-member"
  | "unknown-fund-holder"
  | "unknown-currency"
  | "invalid-amount"
  | "invalid-rate"
  | "base-rate-must-be-one"
  | "empty-split"
  | "split-sum-mismatch"
  | "self-payment";

export interface LedgerIssue {
  code: LedgerIssueCode;
  /** 문제가 있는 지출·공금 걷기·보냄 기록의 id */
  entryId?: string;
  memberId?: string;
}

export class MoneyLedgerError extends Error {
  readonly issues: LedgerIssue[];

  constructor(issues: LedgerIssue[]) {
    super("정산 데이터를 확인해주세요.");
    this.name = "MoneyLedgerError";
    this.issues = issues;
  }
}

type LedgerContext = Pick<MoneyLedger, "baseCurrency" | "members">;

/** 장부 전체를 검사한다. 문제가 없으면 빈 목록. */
export function validateLedger(ledger: MoneyLedger): LedgerIssue[] {
  if (!isCurrencyCode(ledger.baseCurrency)) return [{ code: "unknown-currency" }];

  const issues: LedgerIssue[] = [];
  const memberIds = new Set<string>();
  for (const member of ledger.members) {
    if (memberIds.has(member.id)) {
      issues.push({ code: "duplicate-member", memberId: member.id });
    }
    memberIds.add(member.id);
  }
  if (!memberIds.has(ledger.fundHolderId)) {
    issues.push({ code: "unknown-fund-holder", memberId: ledger.fundHolderId });
  }

  for (const expense of ledger.expenses) {
    issues.push(...validateExpense(expense, ledger));
  }

  for (const contribution of ledger.fundContributions) {
    issues.push(
      ...validateConvertible(contribution, contribution.id, ledger.baseCurrency),
    );
    if (!memberIds.has(contribution.memberId)) {
      issues.push({
        code: "unknown-member",
        entryId: contribution.id,
        memberId: contribution.memberId,
      });
    }
  }

  for (const payment of ledger.payments) {
    if (!isAmountInRange(payment.amount)) {
      issues.push({ code: "invalid-amount", entryId: payment.id });
    }
    for (const memberId of new Set([payment.fromMemberId, payment.toMemberId])) {
      if (!memberIds.has(memberId)) {
        issues.push({ code: "unknown-member", entryId: payment.id, memberId });
      }
    }
    if (payment.fromMemberId === payment.toMemberId) {
      issues.push({ code: "self-payment", entryId: payment.id });
    }
  }

  return issues;
}

/** 지출 한 건의 금액·환율·분담을 검사한다. 화면 연결 후 저장 전 검증에 사용할 함수다. */
export function validateExpense(
  expense: LedgerExpense,
  context: LedgerContext,
): LedgerIssue[] {
  if (!isCurrencyCode(context.baseCurrency)) return [{ code: "unknown-currency" }];

  const entryId = expense.id;
  const memberIds = new Set(context.members.map((member) => member.id));
  const issues = validateConvertible(expense, entryId, context.baseCurrency);

  if (expense.paidBy.kind === "member" && !memberIds.has(expense.paidBy.memberId)) {
    issues.push({ code: "unknown-member", entryId, memberId: expense.paidBy.memberId });
  }

  const splitMemberIds =
    expense.split.kind === "even"
      ? expense.split.memberIds
      : expense.split.shares.map((share) => share.memberId);
  if (splitMemberIds.length === 0) {
    issues.push({ code: "empty-split", entryId });
  }
  const seen = new Set<string>();
  for (const memberId of splitMemberIds) {
    if (!memberIds.has(memberId)) {
      issues.push({ code: "unknown-member", entryId, memberId });
    } else if (seen.has(memberId)) {
      issues.push({ code: "duplicate-member", entryId, memberId });
    }
    seen.add(memberId);
  }

  if (expense.split.kind === "custom" && expense.split.shares.length > 0) {
    const amounts = expense.split.shares.map((share) => share.amount);
    const amountsAreValid = amounts.every(
      (amount) =>
        Number.isSafeInteger(amount) && amount >= 0 && amount <= MAX_MINOR_AMOUNT,
    );
    if (!amountsAreValid) {
      issues.push({ code: "invalid-amount", entryId });
    } else if (amounts.reduce((sum, amount) => sum + amount, 0) !== expense.amount) {
      issues.push({ code: "split-sum-mismatch", entryId });
    }
  }

  return issues;
}

function validateConvertible(
  entry: ConvertibleAmount,
  entryId: string,
  baseCurrency: CurrencyCode,
): LedgerIssue[] {
  if (!isCurrencyCode(entry.currency)) return [{ code: "unknown-currency", entryId }];

  const issues: LedgerIssue[] = [];
  const hasValidRate = parseRate(entry.rateToBase) !== undefined;
  if (!hasValidRate) {
    issues.push({ code: "invalid-rate", entryId });
  } else if (entry.currency === baseCurrency && entry.rateToBase !== "1") {
    issues.push({ code: "base-rate-must-be-one", entryId });
  }

  if (
    !isAmountInRange(entry.amount) ||
    (hasValidRate && convertToBase(entry, baseCurrency) > MAX_MINOR_AMOUNT)
  ) {
    issues.push({ code: "invalid-amount", entryId });
  }

  return issues;
}

function isAmountInRange(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_MINOR_AMOUNT;
}
