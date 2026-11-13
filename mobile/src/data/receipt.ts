import { CURRENCY_DIGITS } from "../../../src/domain/money/currency";
import type { CurrencyCode } from "../../../src/domain/money/types";
import type { ExpenseCategory } from "../../../src/domain/workspace/types";
import { guessCategory } from "./budgetPlan";

// 영수증 사진에서 읽은 줄로 지출 초안을 만든다. 사진은 기기에서 읽고, 여기서는 글자만 다룬다.
// 확실하지 않은 값은 비워 두고 사용자가 지출 적기 화면에서 확인한다.

export interface ReceiptDraft {
  title: string;
  amount?: number;
  currency: CurrencyCode;
  category: ExpenseCategory;
  method: "card" | "cash";
}

// 합계 줄. 앞쪽이 더 믿을 만하다(결제 금액 > 합계 > 소계).
const TOTAL_STRONG = /(결제\s?금액|받을\s?금액|청구\s?금액|합\s?계|총\s?액|총\s?금액|amount\s?due|grand\s?total|^\s*total\b|\btotal\s?(?:eur|usd|gbp|due|à payer|a pagar)?\s*[:：]?|totale|gesamt(?:betrag)?|summe|importe|à payer|お会計|ご請求|合\s?計|総\s?額|税込)/i;
const TOTAL_WEAK = /(소\s?계|sub\s?total|小\s?計|zwischensumme)/i;
// 합계처럼 보여도 금액이 아닌 줄
const NOT_TOTAL = /(부가세|세액|과세|면세|vat|tax|tva|iva|mwst|거스름|잔돈|change|お釣り|釣銭|預り|받은\s?돈|cash\s?tendered|tendered|point|포인트|할인|discount|割引)/i;
const NOISE = /(\d{2,4}[-./]\d{1,2}[-./]\d{1,4}|\d{1,2}:\d{2}|\btel\b|전화|☎|\d{2,4}-\d{3,4}-\d{4}|사업자|vat\s?no|tax\s?id|no\.\s?\d|#\d)/i;

const CURRENCY_HINTS: [RegExp, CurrencyCode][] = [
  [/€|\beur\b|유로/i, "EUR"],
  [/£|\bgbp\b/i, "GBP"],
  [/₩|\bkrw\b|원\b|원$/i, "KRW"],
  [/円|\bjpy\b|¥/i, "JPY"],
  [/฿|\bthb\b|บาท/i, "THB"],
  [/₫|\bvnd\b/i, "VND"],
  [/\bchf\b|fr\./i, "CHF"],
  [/\bsgd\b|s\$/i, "SGD"],
  [/\bhkd\b|hk\$/i, "HKD"],
  [/\btwd\b|nt\$/i, "TWD"],
  [/\baud\b|a\$/i, "AUD"],
  [/\bcad\b|c\$/i, "CAD"],
  [/\bnzd\b|nz\$/i, "NZD"],
  [/\bmyr\b|\brm\s?\d/i, "MYR"],
  [/\bidr\b|\brp\.?\s?\d/i, "IDR"],
  [/\bphp\b|₱/i, "PHP"],
  [/\binr\b|₹/i, "INR"],
  [/\baed\b/i, "AED"],
  [/\bcny\b|\brmb\b|元/i, "CNY"],
  [/\busd\b|us\$/i, "USD"],
];
const DOLLARS: CurrencyCode[] = ["USD", "AUD", "CAD", "NZD", "SGD", "HKD", "TWD"];

/** 줄에 있는 금액 숫자들. "1,234.56" "1.234,56" "12 000" "3,50" 모두 읽는다. */
export function amountsIn(line: string, currency: CurrencyCode): number[] {
  const digits = CURRENCY_DIGITS[currency];
  const out: number[] = [];
  for (const m of line.matchAll(/(?<![\d.,])(\d{1,3}(?:[ .,'’]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d])/g)) {
    const raw = m[1]!;
    let normalized: string;
    const lastSep = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
    const tail = lastSep >= 0 ? raw.slice(lastSep + 1) : "";
    if (lastSep >= 0 && tail.length <= 2 && digits > 0) {
      normalized = raw.slice(0, lastSep).replace(/[ .,'’]/g, "") + "." + tail;
    } else if (lastSep >= 0 && tail.length <= 2 && digits === 0) {
      // 원·엔 영수증의 "12.00" 같은 꼬리는 소수로 읽고 버린다.
      normalized = raw.slice(0, lastSep).replace(/[ .,'’]/g, "");
    } else {
      normalized = raw.replace(/[ .,'’]/g, "");
    }
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) continue;
    const minor = Math.round(value * 10 ** digits);
    if (minor > 0 && minor <= 1_000_000_000_000) out.push(minor);
  }
  return out;
}

function detectCurrency(text: string, local: CurrencyCode): CurrencyCode {
  for (const [pattern, code] of CURRENCY_HINTS) if (pattern.test(text)) return code;
  if (/\$/.test(text)) return DOLLARS.includes(local) ? local : "USD";
  return local;
}

function findTotal(lines: string[], currency: CurrencyCode): number | undefined {
  const pick = (pattern: RegExp) => {
    // 같은 말이 여러 번 나오면 아래쪽(최종 합계)을 쓴다.
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (!pattern.test(line) || NOT_TOTAL.test(line)) continue;
      const here = amountsIn(line.replace(NOISE, " "), currency);
      if (here.length) return here[here.length - 1];
      // 금액이 다음 줄에 따로 찍히는 영수증도 있다.
      const next = lines[i + 1];
      if (next && !NOT_TOTAL.test(next)) {
        const below = amountsIn(next.replace(NOISE, " "), currency);
        if (below.length) return below[below.length - 1];
      }
    }
    return undefined;
  };
  const strong = pick(TOTAL_STRONG);
  if (strong !== undefined) return strong;
  const weak = pick(TOTAL_WEAK);
  if (weak !== undefined) return weak;
  // 합계라는 말이 없으면 가장 큰 금액. 날짜·전화번호 줄은 뺀다.
  const all = lines.filter((l) => !NOISE.test(l) && !NOT_TOTAL.test(l)).flatMap((l) => amountsIn(l, currency));
  return all.length ? Math.max(...all) : undefined;
}

function findTitle(lines: string[]) {
  for (const line of lines.slice(0, 6)) {
    const text = line.trim();
    const letters = text.replace(/[^\p{L}]/gu, "").length;
    if (letters >= 2 && letters >= text.length * 0.5 && !NOISE.test(text) && !/영수증|receipt|領収|レシート|ticket|facture|scontrino|tax invoice/i.test(text)) return text.slice(0, 40);
  }
  return "";
}

export function parseReceipt(lines: string[], local: CurrencyCode): ReceiptDraft | undefined {
  const clean = lines.map((l) => l.normalize("NFKC").trim()).filter(Boolean);
  if (!clean.length) return undefined;
  const text = clean.join("\n");
  const currency = detectCurrency(text, local);
  const title = findTitle(clean);
  return {
    title,
    amount: findTotal(clean, currency),
    currency,
    category: guessCategory(title) ?? guessCategory(text) ?? "other",
    method: /현금|cash|現金|espèces|efectivo|contanti|bar\b/i.test(text) && !/카드|card|カード|visa|master|amex/i.test(text) ? "cash" : "card",
  };
}
