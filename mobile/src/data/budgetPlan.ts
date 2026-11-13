import type { ExpenseCategory, TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import { CURRENCY_DIGITS, convertToBase } from "../../../src/domain/money/currency";
import type { CurrencyCode } from "../../../src/domain/money/types";
import { zonedDate } from "../../../src/domain/time/zoned";

// 경비 탭의 "봉투". 하루 예산을 분류별 비율(%)로 나누고, 그날 쓴 돈을 분류별로 모은다.
// 금액은 모두 정산 통화의 최소 단위(원이면 원, 유로면 센트).

// 분류 이름은 사전(cat.*), 색은 theme/tokens의 categoryTone이 맡는다.
export const CATEGORIES: { key: ExpenseCategory }[] = [
  { key: "food" },
  { key: "drink" },
  { key: "transport" },
  { key: "admission" },
  { key: "shopping" },
  { key: "other" },
];

export type Shares = Record<ExpenseCategory, number>;

// 여행지와 상관없이 쓰는 기본 비율. 여행마다 다른 점은 사용자가(나중엔 Jev가) 조정한다.
export const DEFAULT_SHARES: Shares = { food: 35, drink: 10, transport: 15, admission: 15, shopping: 15, other: 10 };
export const EVEN_SHARES: Shares = { food: 17, drink: 17, transport: 17, admission: 17, shopping: 16, other: 16 };

const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

export function sharesOf(trip: TripWorkspace): Shares {
  const saved = trip.budget.categoryShares;
  if (!saved) return { ...DEFAULT_SHARES };
  return Object.fromEntries(CATEGORIES.map((c) => [c.key, saved[c.key] ?? 0])) as Shares;
}

/** 하루 예산. 직접 정한 값이 우선이고, 없으면 총예산 ÷ 여행 일수(내림). 둘 다 없으면 undefined. */
export function dailyBudgetOf(trip: TripWorkspace): number | undefined {
  if (trip.budget.dailyBudgetMinor !== undefined) return trip.budget.dailyBudgetMinor;
  const total = trip.budget.totalBudgetMinor;
  return total === undefined ? undefined : Math.floor(total / dayCount(trip.settings.startDate, trip.settings.endDate));
}

/**
 * 한 봉투를 step(%p)만큼 늘리거나 줄인다. 합 100을 지키려고 '기타'에서 같은 만큼 빼거나 더한다.
 * 기타가 바닥나면(늘릴 때) 비율이 가장 큰 다른 봉투에서 뺀다. 예: 식비 +5 → 기타 -5.
 */
export function moveShare(shares: Shares, key: ExpenseCategory, step: number): Shares {
  const next = { ...shares };
  const delta = step > 0 ? step : -Math.min(-step, next[key]);
  if (!delta) return next;
  let remaining = delta;
  const donors: ExpenseCategory[] = key === "other" ? [] : ["other"];
  for (const c of [...CATEGORIES].sort((a, b) => shares[b.key] - shares[a.key])) if (c.key !== key && c.key !== "other") donors.push(c.key);
  if (remaining < 0) {
    next[key] += remaining;
    next[key === "other" ? donors[0] ?? "food" : "other"] -= remaining;
    return next;
  }
  for (const d of donors) {
    const take = Math.min(remaining, next[d]);
    next[d] -= take;
    next[key] += take;
    remaining -= take;
    if (!remaining) break;
  }
  return next;
}

/** 비율로 금액을 나눈다. 반올림 오차로 합이 하루 예산과 달라지지 않게 남는 단위는 큰 봉투부터 준다. */
export function envelopeLimits(daily: number, shares: Shares): Shares {
  const raw = CATEGORIES.map((c) => ({ key: c.key, exact: (daily * shares[c.key]) / 100 }));
  const result = Object.fromEntries(raw.map((r) => [r.key, Math.floor(r.exact)])) as Shares;
  let left = daily - raw.reduce((sum, r) => sum + Math.floor(r.exact), 0);
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1) || shares[b.key] - shares[a.key])) {
    if (left <= 0) break;
    result[r.key] += 1;
    left -= 1;
  }
  return result;
}

export interface Envelope {
  key: ExpenseCategory;
  spent: number;
  limit?: number;
}

/** 그날(여행지 날짜) 분류별로 쓴 돈과 봉투 한도 */
export function envelopesFor(trip: TripWorkspace, date: string): { spent: number; daily?: number; envelopes: Envelope[] } {
  const base = trip.settings.baseCurrency;
  const spentBy = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Shares;
  for (const e of trip.ledger.expenses) {
    if (zonedDate(e.occurredAt, trip.settings.timeZone) !== date) continue;
    spentBy[e.category in spentBy ? e.category : "other"] += convertToBase(e, base);
  }
  const daily = dailyBudgetOf(trip);
  const limits = daily === undefined ? undefined : envelopeLimits(daily, sharesOf(trip));
  return {
    spent: Object.values(spentBy).reduce((a, b) => a + b, 0),
    daily,
    envelopes: CATEGORIES.map((c) => ({ ...c, spent: spentBy[c.key], limit: limits?.[c.key] })),
  };
}

/** 이 통화로 마지막에 적은 환율. 정산 통화면 "1", 처음 쓰는 통화면 undefined라서 직접 적어야 한다. */
export function knownRate(trip: TripWorkspace, currency: CurrencyCode): string | undefined {
  if (currency === trip.settings.baseCurrency) return "1";
  return [...trip.ledger.expenses].filter((e) => e.currency === currency).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]?.rateToBase;
}

/** 하루 예산에서 빼는 미리 결제한 예약(항공·숙소) */
export function prepaid(trip: TripWorkspace): Reservation[] {
  return (trip.reservations ?? []).filter((r) => r.kind === "flight" || r.kind === "stay");
}

// 메모로 분류를 짐작하는 낱말. 어느 나라에서나 통하는 말만 둔다(특정 나라 상호는 넣지 않는다).
// 순서가 우선순위다: "카페 입장권"처럼 겹치면 앞의 규칙이 이긴다.
const RULES: [ExpenseCategory, RegExp][] = [
  ["admission", /입장|티켓|ticket|museum|뮤지엄|박물관|미술관|gallery|갤러리|전망대|observatory|tour|투어|공연|concert|show|테마파크|theme ?park|zoo|동물원|aquarium|수족관|castle|궁|성당|cathedral|temple|사원|admission|entry/i],
  ["transport", /택시|taxi|uber|grab|bolt|lyft|지하철|metro|subway|버스|bus|기차|train|rail|tram|트램|페리|ferry|교통|transit|주유|fuel|gas station|주차|parking|공항|airport|렌트|rental car|toll|통행료|교통카드|transport/i],
  ["drink", /카페|cafe|café|coffee|커피|라떼|latte|tea|차 |디저트|dessert|bakery|베이커리|빵|케이크|cake|아이스크림|ice ?cream|gelato|젤라또|도넛|donut|bubble|버블티|juice|주스/i],
  ["shopping", /쇼핑|shop|store|mall|몰|아울렛|outlet|면세|duty ?free|기념품|souvenir|선물|gift|옷|clothes|마트|supermarket|grocery|편의점|convenience|약국|pharmacy|drugstore/i],
  ["food", /식당|restaurant|점심|저녁|아침|lunch|dinner|breakfast|brunch|브런치|bistro|비스트로|라멘|ramen|국수|noodle|pizza|피자|burger|버거|sushi|스시|초밥|bbq|바베큐|고기|steak|스테이크|taco|타코|pho|쌀국수|pub|펍|bar|와인|wine|beer|맥주|market|시장|food|음식|밥|meal/i],
];

/** 메모로 분류를 짐작한다. 모르면 undefined(사용자가 고르게 둔다). */
export function guessCategory(title: string): ExpenseCategory | undefined {
  const text = ` ${title.trim()} `;
  if (!title.trim()) return undefined;
  return RULES.find(([, re]) => re.test(text))?.[0];
}

const SYMBOLS: Partial<Record<CurrencyCode, string>> = { KRW: "₩", JPY: "¥", USD: "$", EUR: "€", GBP: "£", CNY: "¥", THB: "฿", VND: "₫" };

/** 흔한 통화의 기호. 기호가 없는 통화는 undefined라서 코드만 쓴다. */
export function currencySymbol(currency: CurrencyCode): string | undefined {
  return SYMBOLS[currency];
}

/** 내역 줄의 금액은 쓴 통화 그대로. 예: €24.50, ₩5,000, 120.00 MYR */
export function formatShort(amount: number, currency: CurrencyCode): string {
  const symbol = SYMBOLS[currency];
  return symbol ? `${symbol}${plainAmount(amount, currency)}` : `${plainAmount(amount, currency)} ${currency}`;
}

/** 기호 없이 숫자만. 큰 숫자 옆에 통화를 따로 붙일 때 쓴다. 예: 84300 KRW → "84,300", 2450 EUR → "24.50" */
export function plainAmount(amount: number, currency: CurrencyCode): string {
  const digits = CURRENCY_DIGITS[currency];
  return new Intl.NumberFormat("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount / 10 ** digits);
}
