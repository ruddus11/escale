import type { ConvertibleAmount, CurrencyCode, DecimalRate } from "./types";

/** 원·엔은 그대로 저장하고, 달러는 센트로 저장한다. 예: $1.25 → 125. */
export const CURRENCY_DIGITS: Readonly<Record<CurrencyCode, number>> = {
  KRW: 0,
  JPY: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CNY: 2,
  TWD: 2,
  HKD: 2,
  SGD: 2,
  THB: 2,
  VND: 0,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  NZD: 2,
  IDR: 2,
  MYR: 2,
  PHP: 2,
  INR: 2,
  AED: 2,
  KWD: 3,
};

/** 정수부 최대 6자리(앞자리 0 없음), 소수부 최대 10자리 */
const RATE_PATTERN = /^(0|[1-9]\d{0,5})(\.\d{1,10})?$/;

export interface RateFraction {
  numerator: bigint;
  denominator: bigint;
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && Object.hasOwn(CURRENCY_DIGITS, value);
}

/** 환율을 정수 분수로 읽는다. 예: "9.124" → 9124 / 1000. 잘못된 값은 undefined. */
export function parseRate(rate: DecimalRate): RateFraction | undefined {
  if (typeof rate !== "string" || !RATE_PATTERN.test(rate)) return undefined;

  const [whole, fraction = ""] = rate.split(".");
  const numerator = BigInt(`${whole}${fraction}`);
  if (numerator === 0n) return undefined;

  return { numerator, denominator: 10n ** BigInt(fraction.length) };
}

/** 반올림 오차를 피하려고 BigInt로 환산한 뒤, 마지막에 한 번만 반올림한다(0.5 올림). */
export function convertToBase(
  entry: ConvertibleAmount,
  baseCurrency: CurrencyCode,
): number {
  const rate = parseRate(entry.rateToBase);
  if (
    rate === undefined ||
    !isCurrencyCode(entry.currency) ||
    !isCurrencyCode(baseCurrency) ||
    !Number.isSafeInteger(entry.amount) ||
    entry.amount < 0
  ) {
    throw new RangeError("Cannot convert an invalid money entry");
  }

  const numerator =
    BigInt(entry.amount) *
    rate.numerator *
    10n ** BigInt(CURRENCY_DIGITS[baseCurrency]);
  const denominator =
    rate.denominator * 10n ** BigInt(CURRENCY_DIGITS[entry.currency]);
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_DIGITS) as CurrencyCode[];
export function parseMoney(value: string, currency: CurrencyCode): number | undefined {
  const digits = CURRENCY_DIGITS[currency];
  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${digits || 1}})?$`);
  if (!pattern.test(value.trim()) || (digits === 0 && value.includes("."))) return undefined;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = BigInt(whole!) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, "0") || "0");
  return amount <= 1_000_000_000_000n ? Number(amount) : undefined;
}
export function moneyInput(amount: number | undefined, currency: CurrencyCode): string {
  if (amount === undefined) return "";
  return (amount / 10 ** CURRENCY_DIGITS[currency]).toFixed(CURRENCY_DIGITS[currency]);
}
export function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    minimumFractionDigits: CURRENCY_DIGITS[currency],
    maximumFractionDigits: CURRENCY_DIGITS[currency],
  }).format(amount / 10 ** CURRENCY_DIGITS[currency]).replace("JP¥", "¥");
}
