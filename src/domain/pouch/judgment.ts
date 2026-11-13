import type { ExpenseCategory } from "../workspace/types";

// 여행 도구가 기기 안 규칙으로 읽지 못한 한 줄을 Jev가 판단한 결과.
// Jev는 글을 쓰지 않고 정해진 선택지만 고른다. 금액·제목 같은 값은 앱이 원문에서 꺼낸다.

export const POUCH_INTENTS = [
  "expense",
  "packed",
  "unpacked",
  "pack_add",
  "note",
  "ask_left",
  "ask_stay",
  "ask_next",
  "ask_tomorrow",
  "ask_pack",
  "ask_bookings",
  "ask_today",
  "other",
] as const;
export type PouchIntentName = (typeof POUCH_INTENTS)[number];

export const SPEND_CATEGORIES = ["food", "drink", "transport", "admission", "shopping", "other"] as const satisfies readonly ExpenseCategory[];

export const MAX_POUCH_TEXT = 200;
export const MAX_POUCH_ITEMS = 50;

export interface PouchItemRef {
  id: string;
  title: string;
}

export interface PouchJudgment {
  intent: PouchIntentName;
  /** 고른 의도의 확신(0~1). 앱이 이 값으로 바로 보일지, 되물을지 정한다. */
  confidence: number;
  /** 돈을 쓴 줄이라면 어떤 분류인지. 지출이 아니면 의미 없다. */
  category: ExpenseCategory;
  /** 준비물 목록에서 가리킨 것. 확신이 낮거나 없으면 생략한다. */
  itemId?: string;
}

export function isPouchJudgment(value: unknown): value is PouchJudgment {
  const v = value as PouchJudgment;
  return (
    !!v &&
    typeof v === "object" &&
    (POUCH_INTENTS as readonly string[]).includes(v.intent) &&
    typeof v.confidence === "number" &&
    v.confidence >= 0 &&
    v.confidence <= 1 &&
    (SPEND_CATEGORIES as readonly string[]).includes(v.category) &&
    (v.itemId === undefined || (typeof v.itemId === "string" && v.itemId.length > 0 && v.itemId.length <= 120))
  );
}
