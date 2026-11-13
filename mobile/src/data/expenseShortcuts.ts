import type { CurrencyCode } from "../../../src/domain/money/types";
import type { ExpenseCategory, PaymentMethod, TripExpense } from "../../../src/domain/workspace/types";

// 자주 쓰는 지출 바로 넣기. 이 기기에 저장된 지출만 보고 계산하며 서버로 보내지 않는다.
// 분류·금액·통화·결제 수단·메모가 모두 같은 지출을 한 묶음으로 세고, 여러 번 반복된 묶음을 위에서부터 고른다.
// 금액은 통화의 최소 단위다. 예: ¥500은 500, $3.50은 350. 같은 500이라도 통화가 다르면 다른 묶음이다.

export interface ExpenseShortcut {
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  /** 같은 묶음이 기록된 횟수. */
  count: number;
}

export const SHORTCUT_LIMIT = 4;
/** 한 번만 쓴 지출은 우연일 수 있어 두 번부터 보여 준다. */
export const SHORTCUT_MIN_REPEAT = 2;

type Source = Pick<TripExpense, "title" | "category" | "amount" | "currency" | "method" | "occurredAt">;

// 메모는 앞뒤 공백·여러 칸 공백·대소문자만 무시하고 비교한다. 예: " 7-Eleven " = "7-eleven".
const titleKey = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * 반복된 지출 묶음을 많이 쓴 순서로 limit개까지 돌려준다.
 * 횟수가 같으면 최근에 쓴 묶음, 그것도 같으면 묶음 열쇠(분류·금액·통화·수단·메모) 순으로 정해 매번 같은 순서가 나온다.
 * currencies를 주면 그 통화의 묶음만 고른다(다른 나라 여행의 엔화 묶음을 유로 여행에 띄우지 않게).
 * 결제 수단이 없는 예전 지출은 카드로 본다(지출 편집기의 기본값과 같다).
 */
export function frequentExpenses(
  expenses: readonly Source[],
  options: { limit?: number; minRepeat?: number; currencies?: readonly string[] } = {},
): ExpenseShortcut[] {
  const { limit = SHORTCUT_LIMIT, minRepeat = SHORTCUT_MIN_REPEAT, currencies } = options;
  const groups = new Map<string, ExpenseShortcut & { key: string; last: number }>();
  for (const e of expenses) {
    const title = (e.title ?? "").trim().replace(/\s+/g, " ");
    if (!title || !Number.isSafeInteger(e.amount) || e.amount <= 0) continue;
    if (currencies && !currencies.includes(e.currency)) continue;
    const method = e.method ?? "card";
    const key = [e.category, e.amount, e.currency, method, titleKey(title)].join("\u0000");
    const at = Date.parse(e.occurredAt);
    const last = Number.isFinite(at) ? at : 0;
    const group = groups.get(key);
    if (!group) groups.set(key, { key, title, category: e.category, amount: e.amount, currency: e.currency, method, count: 1, last });
    else {
      group.count += 1;
      // 표시하는 메모는 가장 최근에 적은 모양을 따른다.
      if (last >= group.last) {
        group.last = last;
        group.title = title;
      }
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= minRepeat)
    .sort((a, b) => b.count - a.count || b.last - a.last || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, Math.max(0, limit))
    .map(({ key: _key, last: _last, ...shortcut }) => shortcut);
}
