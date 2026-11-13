import { parseRate } from "../../../src/domain/money/currency";
import type { CurrencyCode } from "../../../src/domain/money/types";
import { fetchWithTimeout } from "./fetchWithTimeout";

// 오늘 환율(유럽중앙은행 기준가, Frankfurter). 요청 매개변수는 통화 코드 두 개이고, 서버에는 기기 IP 주소도 전달된다.
// 대만 달러·베트남 동·디르함·디나르는 이 목록에 없어 직접 적어야 한다.
const SUPPORTED = new Set<CurrencyCode>(["KRW", "JPY", "USD", "EUR", "GBP", "CNY", "HKD", "SGD", "THB", "AUD", "CAD", "CHF", "NZD", "IDR", "MYR", "PHP", "INR"]);
const ENDPOINT = "https://api.frankfurter.dev/v1/latest";
// 같은 짝은 반나절 동안 다시 묻지 않는다.
const KEEP_MS = 12 * 60 * 60 * 1000;

export interface LiveRate {
  /** 1 from = rate to. 지출의 rateToBase 형식(정수 6자리, 소수 10자리까지) */
  rate: string;
  /** 기준가 날짜 YYYY-MM-DD */
  date: string;
}

const cache = new Map<string, { at: number; value: LiveRate }>();

export function canFetchRate(from: CurrencyCode, to: CurrencyCode) {
  return from !== to && SUPPORTED.has(from) && SUPPORTED.has(to);
}

/** 숫자 환율을 저장 형식 문자열로. 유효 숫자 6자리로 줄이고, 형식에 안 맞으면 undefined. */
export function toRateText(value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const digits = value >= 1 ? Math.max(0, 6 - String(Math.floor(value)).length) : Math.min(10, 5 - Math.floor(Math.log10(value)));
  const text = value.toFixed(Math.max(0, digits)).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return parseRate(text) ? text : undefined;
}

/** 오늘 환율을 받아 온다. 지원하지 않는 통화이거나 연결이 안 되면 undefined(직접 적게 둔다). */
export async function fetchRate(from: CurrencyCode, to: CurrencyCode, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<LiveRate | undefined> {
  if (!canFetchRate(from, to)) return undefined;
  const key = `${from}>${to}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < KEEP_MS) return hit.value;
  try {
    // 제한 시간이 지나도 다른 실패처럼 undefined로 끝나 직접 적는 칸이 남는다.
    const response = await fetchWithTimeout(`${ENDPOINT}?from=${from}&to=${to}`, {}, { fetchImpl });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { date?: unknown; rates?: Record<string, unknown> };
    const raw = body?.rates?.[to];
    const rate = typeof raw === "number" ? toRateText(raw) : undefined;
    if (!rate || typeof body.date !== "string") return undefined;
    const value = { rate, date: body.date };
    cache.set(key, { at: now, value });
    return value;
  } catch {
    return undefined;
  }
}
