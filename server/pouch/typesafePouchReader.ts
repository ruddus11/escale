import { TypeSafeClient, choice } from "@typesafe-ai/sdk";
import {
  SPEND_CATEGORIES,
  type PouchIntentName,
  type PouchItemRef,
  type PouchJudgment,
} from "../../src/domain/pouch/judgment.js";
import type { ExpenseCategory } from "../../src/domain/workspace/types.js";

const REQUEST_TIMEOUT_MS = 8_000;
// 준비물 고르기는 이보다 확신이 낮으면 비워 두고 앱이 목록을 보여 준다.
const MIN_ITEM_CONFIDENCE = 0.5;
const NONE = "none";

export interface PouchReader {
  read(text: string, items: PouchItemRef[]): Promise<PouchJudgment>;
}

// 의도는 하나만 고른다. 자주 쓰는 것부터 두고 "그 밖"은 맨 끝에 둔다.
const INTENT = choice(
  "`text` is one short line a traveler typed into the trip kit of a travel notebook app. It may be Korean, English or Japanese. What does the traveler want the trip kit to do with this line?",
  {
    expense: "Record money they spent: a meal, coffee, fare, ticket or purchase, even if no amount is written.",
    packed: "Mark something as packed, brought or already in the bag.",
    unpacked: "Mark something as not packed, forgotten or left behind.",
    pack_add: "Add something they still need to pack or bring.",
    note: "Save a sentence about their day as a diary note.",
    ask_left: "Ask how much money is left today or how much they spent.",
    ask_stay: "Ask about tonight's accommodation, its check-in or check-out.",
    ask_next: "Ask about the next flight, train, bus or other ride.",
    ask_tomorrow: "Ask what is planned for tomorrow.",
    ask_pack: "Ask to see the packing list.",
    ask_bookings: "Ask to see all bookings or reservations.",
    ask_today: "Ask to see today's diary notes.",
    other: "Anything else, including greetings and requests the trip kit cannot handle.",
  } satisfies Record<PouchIntentName, string>,
);

// 지출이 아닐 수도 있지만 같은 요청에서 미리 묻는다. 지출일 때만 앱이 쓴다.
const CATEGORY = choice("If `text` records money the traveler spent, what was it spent on?", {
  food: "A meal, snack, restaurant, bar or groceries.",
  drink: "Coffee, tea, juice, dessert or a café.",
  transport: "A taxi, train, bus, ferry, flight, fuel, parking or other getting around.",
  admission: "A ticket for a museum, sight, tour, show or activity.",
  shopping: "Souvenirs, clothes, gifts, cosmetics, a pharmacy or other goods.",
  other: "Anything else, or the line is not about spending.",
} satisfies Record<ExpenseCategory, string>);

function itemQuestion(items: PouchItemRef[]) {
  return choice("Which item in `packing` is `text` about?", {
    ...Object.fromEntries(items.map((item, i) => [`i${i}`, item.title])),
    [NONE]: "None of the listed items.",
  });
}

type ChoiceAnswer = { choice: string; confidence: number };

/** Jev의 답을 앱에 줄 판단으로 바꾼다. 준비물 키(i0, i1…)는 실제 id로 돌려놓는다. */
export function toJudgment(
  answers: { intent: ChoiceAnswer; category: ChoiceAnswer; item?: ChoiceAnswer },
  items: PouchItemRef[],
): PouchJudgment {
  const category = (SPEND_CATEGORIES as readonly string[]).includes(answers.category.choice)
    ? (answers.category.choice as ExpenseCategory)
    : "other";
  const judgment: PouchJudgment = {
    intent: answers.intent.choice as PouchIntentName,
    confidence: answers.intent.confidence,
    category,
  };
  const item = answers.item;
  const index = item && item.choice !== NONE && item.confidence >= MIN_ITEM_CONFIDENCE ? Number(item.choice.slice(1)) : -1;
  if (index >= 0 && items[index]) judgment.itemId = items[index].id;
  return judgment;
}

export function createTypeSafePouchReader(apiKey: string): PouchReader {
  const client = new TypeSafeClient({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return {
    async read(text, items) {
      if (!items.length) {
        const { answers } = await client.systemOne({ state: { text }, questions: { intent: INTENT, category: CATEGORY } });
        return toJudgment(answers, items);
      }
      const { answers } = await client.systemOne({
        state: { text, packing: items.map((item) => item.title) },
        questions: { intent: INTENT, category: CATEGORY, item: itemQuestion(items) },
      });
      return toJudgment(answers, items);
    },
  };
}
