import type { Reservation } from "../reservations/types";
import type {
  CurrencyCode,
  FundContribution,
  LedgerExpense,
  Member,
  SettlementPayment,
} from "../money/types";
import type { SchedulePlan } from "../schedule/types";
import type { TransitOption } from "../transit/types";

export type ExpenseCategory =
  | "transport"
  | "food"
  | "drink"
  | "admission"
  | "shopping"
  | "other";

export type PaymentMethod = "card" | "cash";

export type CoverColor = "cobalt" | "ink" | "sky";

export interface BudgetSettings {
  totalBudgetMinor?: number;
  emergencyReserveMinor: number;
  mealBudgetPerPersonMinor?: number;
  /** 하루에 쓸 돈(정산 통화 최소 단위). 있으면 총예산을 일수로 나눈 값보다 우선한다. */
  dailyBudgetMinor?: number;
  /** 하루 예산을 분류별로 나눈 비율(%). 합은 100. 없으면 기본 비율을 쓴다. */
  categoryShares?: Partial<Record<ExpenseCategory, number>>;
}

export interface StoredRouteSegment {
  originActivityId: string;
  destinationActivityId: string;
  departureBasis: "plan" | "now";
  options: TransitOption[];
  fetchedAt: string;
}

/** 여행 정보의 기준값. 일정의 같은 필드는 기존 화면 호환용으로 남아 있다. */
export interface TripSettings {
  title: string;
  /** 여행지는 정해지지 않았으면 생략한다. */
  destination?: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  /** IANA 시간대 이름. 예: "Asia/Tokyo" */
  timeZone: string;
  /** 정산에 쓰는 통화 */
  baseCurrency: CurrencyCode;
  /** 여행지에서 주로 쓰는 통화 */
  localCurrency: CurrencyCode;
  /** 순서가 표시 순서이자 남는 1원 배분 순서다. */
  members: Member[];
  /** 총무('나'). 남은 공금을 들고 있는 사람으로 계산한다. */
  ownerId: string;
  coverColor?: CoverColor;
  /** 다 쓴 수첩. 표지 목록 아래 줄로 간다. */
  archived?: boolean;
}

/** 돈 계산 엔진의 지출에 화면에서 보여 줄 정보를 더한 것 */
export interface TripExpense extends LedgerExpense {
  title?: string;
  category: ExpenseCategory;
  method?: PaymentMethod;
  note?: string;
  occurredAt: string;
}

export interface TripFundContribution extends FundContribution {
  occurredAt: string;
}

export interface TripPayment extends SettlementPayment {
  paidAt: string;
}

export interface TripLedger {
  expenses: TripExpense[];
  fundContributions: TripFundContribution[];
  payments: TripPayment[];
}

/** 수첩 한 권(여행 하나) */
export interface TripWorkspace {
  id: string;
  settings: TripSettings;
  schedule: SchedulePlan;
  budget: BudgetSettings;
  /** 정산 통화가 JPY가 아닌 구버전 수첩의 예산. 환율 없이 환산하지 않고 원금으로 보존한다. */
  legacyYenBudget?: BudgetSettings;
  ledger: TripLedger;
  /** 기본 예약정보. 예전 저장값에는 없어도 된다. */
  reservations?: Reservation[];
  routeSegments?: StoredRouteSegment[];
  updatedAt: string;
}

/** 저장 형식 3: 수첩 여러 권 */
export interface TripLibrary {
  schemaVersion: 3;
  activeTripId: string;
  /** 순서가 수첩 표지 순서다. */
  trips: TripWorkspace[];
  updatedAt: string;
}

/** 저장 형식 1의 지출. 엔화 금액만 있었다. */
export interface LegacyExpense {
  id: string;
  amountMinor: number;
  category: ExpenseCategory;
  note?: string;
  occurredAt: string;
}

/** 저장 형식 1: 오사카 여행 하나만 담던 구조. 예전 저장값과 백업을 읽을 때만 쓴다. */
export interface LegacyTripWorkspace {
  schemaVersion: 1;
  schedule: SchedulePlan;
  budget: BudgetSettings;
  expenses: LegacyExpense[];
  routeSegments?: StoredRouteSegment[];
  updatedAt: string;
}
