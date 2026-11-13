export type CurrencyCode = "KRW" | "JPY" | "USD" | "EUR" | "GBP" | "CNY" | "TWD" | "HKD" | "SGD" | "THB" | "VND" | "AUD" | "CAD" | "CHF" | "NZD" | "IDR" | "MYR" | "PHP" | "INR" | "AED" | "KWD";

/** 그 통화 1단위 = 기준 통화 몇 단위. 소수 문자열. 예: "9.124" (100엔 = 912.40원) */
export type DecimalRate = string;

export interface Member {
  id: string;
  name: string;
}

export interface ConvertibleAmount {
  /** 그 통화의 최소 단위 정수 (원, 엔, 센트) */
  amount: number;
  currency: CurrencyCode;
  /** 입력 당시 환율. 기준 통화로 낸 항목은 "1" */
  rateToBase: DecimalRate;
}

export type ExpensePayer =
  | { kind: "member"; memberId: string }
  | { kind: "fund" };

export interface CustomShare {
  memberId: string;
  /** 지출 통화의 최소 단위 정수 */
  amount: number;
}

export type ExpenseSplit =
  | { kind: "even"; memberIds: string[] }
  | { kind: "custom"; shares: CustomShare[] };

export interface LedgerExpense extends ConvertibleAmount {
  id: string;
  paidBy: ExpensePayer;
  split: ExpenseSplit;
}

export interface FundContribution extends ConvertibleAmount {
  id: string;
  memberId: string;
}

export interface SettlementPayment {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  /** 기준 통화 최소 단위 정수 */
  amount: number;
}

export interface MoneyLedger {
  baseCurrency: CurrencyCode;
  /** 순서가 표시 순서이자 남는 1원 배분·동점 처리 순서 */
  members: Member[];
  /** 남은 공금을 들고 있는 사람. 앱에서는 총무('나') */
  fundHolderId: string;
  expenses: LedgerExpense[];
  fundContributions: FundContribution[];
  payments: SettlementPayment[];
}
