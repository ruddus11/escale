import { CURRENCY_DIGITS, isCurrencyCode } from "../../../src/domain/money/currency";
import type { CurrencyCode } from "../../../src/domain/money/types";
import type { ExpenseCategory } from "../../../src/domain/workspace/types";
import { guessCategory } from "./budgetPlan";

// 여행 도구 입력창에 적은 한 줄을 서버 없이 읽는다. "커피 3.5유로", "우산 챙겼어", "체크인 몇 시" 같은 짧은 말만 다룬다.
// 여기서 모르는 말(unknown)은 나중에 Jev가 맡는다. 그때도 결과는 같은 PouchIntent로 받는다.

/** 칩이나 질문으로 꺼내 보는 것 */
export type PouchTopic = "left" | "stay" | "airport" | "next" | "tomorrow" | "reservations" | "pack" | "today";

export type PouchIntent =
  | { kind: "expense"; title: string; amount: number; currency: CurrencyCode; category: ExpenseCategory; method: "card" | "cash" }
  | { kind: "packed"; itemId: string; done: boolean }
  | { kind: "packAdd"; title: string; done: boolean }
  | { kind: "journal"; text: string }
  | { kind: "ask"; topic: PouchTopic }
  | { kind: "unknown" };

export interface PouchContext {
  /** 통화를 말하지 않았을 때 쓰는 현지 통화 */
  localCurrency: CurrencyCode;
  packing: { id: string; title: string; done: boolean }[];
}

export function readPouch(input: string, ctx: PouchContext): PouchIntent {
  const said = input.normalize("NFKC").replace(/\s+/g, " ").trim();

  // 기록은 쓴 글 그대로 저장하므로 문장부호를 덜기 전에 읽는다.
  const note = said.match(/^(?:기록|메모|일기|한\s?줄|note|journal|diary|日記|メモ)\s*:\s*(.+)$/is);
  if (note?.[1]?.trim()) return { kind: "journal", text: note[1].trim().slice(0, 120) };

  // 끝의 오타성 문장부호만 덜어낸다. 날짜의 /와 금액의 소수점은 그대로 둔다.
  const text = said.replace(/[/?~.!,]+$/g, "").trim();
  if (!text) return { kind: "unknown" };

  const packed = readPacking(text, ctx.packing);
  if (packed) return packed;

  // 문장부호가 붙은 맨숫자는 금액이 아니라 편명·호실 질문일 수 있어 통화가 있을 때만 지출로 읽는다. 예: "호텔 1205?"
  const expense = readExpense(text, ctx.localCurrency, text === said);
  if (expense) return expense;

  // 금액을 먼저 읽은 뒤 공항·항공편 시간 질문을 고른다. 일반 이동 질문보다 우선한다.
  if (isAirportQuestion(text)) return { kind: "ask", topic: "airport" };
  for (const [topic, pattern] of TOPICS) if (pattern.test(text)) return { kind: "ask", topic };
  return { kind: "unknown" };
}

// 공항 가는 차편도 포함한다. 이 말이 있으면 항공편이 아니라 그 차편을 묻는 것이다.
const RIDE = /기차|열차|ktx|버스|공항\s?철도|리무진|셔틀|\btrain\b|\bbus\b|\bshuttle\b|limousine|電車|列車|新幹線|バス|リムジン|シャトル/i;

// 순서가 우선순위다. "내일 기차 몇 시"는 내일 일정보다 이동편으로 읽는다.
const TOPICS: [PouchTopic, RegExp][] = [
  ["left", /남은\s?돈|얼마\s?남|잔액|예산|얼마\s?썼|오늘\s?쓴|budget|money left|remaining|how much.*(left|spent)|残り|予算|使った/i],
  ["stay", /체크\s?인|체크\s?아웃|숙소|호텔|게하|게스트\s?하우스|check[\s-]?in|check[\s-]?out|hotel|hostel|\bstay\b|チェックイン|チェックアウト|宿|ホテル/i],
  ["next", new RegExp(`${RIDE.source}|비행기|항공|탑승|출발|다음\\s?이동|다음에\\s?뭐\\s?타|이제\\s?어디\\s?가|flight|plane|depart|boarding|飛行機|出発`, "i")],
  ["tomorrow", /내일|tomorrow|明日/i],
  ["reservations", /예약|reservation|booking|予約/i],
  ["pack", /짐|준비물|챙길\s?것|packing|pack list|持ち物/i],
  ["today", /기록|일기|journal|diary|日記|記録/i],
];

function isAirportQuestion(text: string): boolean {
  if (RIDE.test(text)) return false;
  if (/몇\s?시에?\s?출발해야/i.test(text)) return true;
  const subject = /공항|비행기|항공편|귀국|출국|\bairport\b|\bflight\b|\bplane\b|空港|飛行機|フライト|帰国|出国/i;
  const timing = /몇\s?시에?|언제|시간|도착|가야|가면|갈까|가는|나가야|출발|when|what\s?time|time|leave|depart|arriv|何時|いつ|出発|到着/i;
  return subject.test(text) && timing.test(text);
}

// ── 지출 ─────────────────────────────────────────────

const DOLLARS: CurrencyCode[] = ["USD", "AUD", "CAD", "NZD", "SGD", "HKD", "TWD"];

/** 숫자 앞에 붙는 기호 */
const PREFIX: Record<string, CurrencyCode | "dollar" | "yen"> = {
  "US$": "USD", "HK$": "HKD", "NT$": "TWD", "NZ$": "NZD", "A$": "AUD", "C$": "CAD", "S$": "SGD",
  $: "dollar", "€": "EUR", "£": "GBP", "¥": "yen", "₩": "KRW", "฿": "THB", "₫": "VND", "₱": "PHP", "₹": "INR",
};

/** 숫자 뒤에 붙는 말. 한글·가나는 앞부분이 맞으면 된다("유로짜리", "원으로"). 긴 말을 먼저 둔다. */
const SUFFIX_WORDS: [string, CurrencyCode | "dollar" | "yen"][] = [
  ["대만달러", "TWD"], ["홍콩달러", "HKD"], ["싱가포르달러", "SGD"], ["호주달러", "AUD"], ["캐나다달러", "CAD"], ["뉴질랜드달러", "NZD"],
  ["루피아", "IDR"], ["달러", "dollar"], ["유로", "EUR"], ["파운드", "GBP"], ["위안", "CNY"], ["바트", "THB"], ["링깃", "MYR"],
  ["페소", "PHP"], ["루피", "INR"], ["디르함", "AED"], ["디나르", "KWD"], ["프랑", "CHF"], ["엔", "JPY"], ["원", "KRW"], ["불", "dollar"], ["동", "VND"],
  ["ドル", "dollar"], ["ユーロ", "EUR"], ["ウォン", "KRW"], ["ポンド", "GBP"], ["バーツ", "THB"], ["円", "JPY"], ["元", "CNY"],
  ["€", "EUR"], ["£", "GBP"], ["¥", "yen"], ["₩", "KRW"], ["฿", "THB"], ["₫", "VND"],
];

/** 숫자 뒤 영어 낱말. 통째로 맞아야 한다. ISO 코드는 따로 받는다. */
const ENGLISH: Record<string, CurrencyCode | "dollar"> = {
  won: "KRW", yen: "JPY", dollar: "dollar", dollars: "dollar", buck: "dollar", bucks: "dollar", euro: "EUR", euros: "EUR",
  pound: "GBP", pounds: "GBP", quid: "GBP", yuan: "CNY", rmb: "CNY", baht: "THB", dong: "VND", franc: "CHF", francs: "CHF",
  rupiah: "IDR", ringgit: "MYR", peso: "PHP", pesos: "PHP", rupee: "INR", rupees: "INR", dirham: "AED", dirhams: "AED", dinar: "KWD", dinars: "KWD",
};

const AMOUNT = /(US\$|HK\$|NT\$|NZ\$|A\$|C\$|S\$|[$€£¥₩฿₫₱₹])?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\s?(?:만|천|万|千))?(\s?(?:[A-Za-z]+|[가-힣]+|[ァ-ヶー]+|[円元€£¥₩฿₫]))?/gu;
const METHOD_CASH = /현금|cash|現金/i;
// 결제 수단은 따로 떨어진 낱말일 때만 뗀다. "교통카드"의 카드는 이름이다.
const METHOD_WORDS = /(^|\s)(?:카드|현금)(?:으로|로)?(?=\s|$)|(^|\s)(?:by card|in cash|card|cash|カード|現金)(?=\s|$)/gi;
const SPENT_WORDS = /(^|\s)(?:썼어요|썼어|썼음|씀|냈어요|냈어|냄|결제했어|결제|지불|샀어요|샀어|샀음|구매|paid|spent|bought|払った|買った)(?=\s|$|[.!?])/gi;

/** "1만2천원" → "12000원", "3만5000원" → "35000원". "2만원"처럼 한 단위면 그대로 둔다. */
function joinKoreanNumbers(text: string) {
  return text
    .replace(/(\d+)\s?만\s?(\d+)\s?천/g, (_, a: string, b: string) => String(Number(a) * 10000 + Number(b) * 1000))
    .replace(/(\d+)만(\d{1,4})(?!\d)/g, (_, a: string, b: string) => String(Number(a) * 10000 + Number(b)));
}

/** 문장에 금액이 있으면 꺼낸다. Jev가 지출이라고 판단한 줄의 금액·제목도 여기서 얻는다. */
export function spendIn(text: string, local: CurrencyCode) {
  const found = readExpense(text.normalize("NFKC").replace(/\s+/g, " ").trim(), local);
  return found?.kind === "expense" ? found : undefined;
}

function readExpense(input: string, local: CurrencyCode, bareAmount = true): PouchIntent | undefined {
  const text = joinKoreanNumbers(input);
  for (const m of text.matchAll(AMOUNT)) {
    const [all, prefix, int, frac, multRaw, tail] = m;
    const start = m.index ?? 0;
    const core = all.slice(0, all.length - (tail?.length ?? 0)); // 기호 + 숫자 + 만·천
    // 시각(14:20)·날짜(10/14) 같은 숫자는 건너뛴다.
    if (/[:/\d]/.test(text[start - 1] ?? "") || /[:/]/.test(text[start + core.length] ?? "")) continue;
    // 숫자 바로 뒤의 "카드", "현금"은 통화가 아니라 결제 수단이다.
    const unit = tail && !/^\s?(?:카드|현금|card|cash)/i.test(tail) ? tail.trim() : undefined;
    const unitCurrency = unit ? fromUnit(unit, local) : undefined;
    if (unit && !unitCurrency && !prefix && !/^[A-Za-z]/.test(unit)) continue; // "3시", "2박", "5번"은 돈이 아니다.
    let currency = prefix ? fromPrefix(prefix, local) : unitCurrency;
    if (!currency) {
      // 통화가 없으면 문장 끝의 숫자이거나 뒤에 결제 수단만 올 때 현지 통화로 읽는다.
      if (!bareAmount || text.slice(start + core.length).replace(METHOD_WORDS, " ").trim()) continue;
      currency = local;
    }
    const mult = multRaw?.trim() ? (/[만万]/.test(multRaw) ? 10000 : 1000) : 1;
    const amount = Math.round(Number(`${int!.replace(/,/g, "")}${frac ? `.${frac}` : ""}`) * mult * 10 ** CURRENCY_DIGITS[currency]);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000_000) return undefined;
    const used = core.length + (unitCurrency ? tail!.length : 0);
    const title = cleanTitle(`${text.slice(0, start)} ${text.slice(start + used)}`);
    return { kind: "expense", title, amount, currency, category: guessCategory(title) ?? "other", method: METHOD_CASH.test(text) ? "cash" : "card" };
  }
  return undefined;
}

function fromPrefix(prefix: string, local: CurrencyCode): CurrencyCode {
  return resolve(PREFIX[prefix]!, local);
}

function fromUnit(unit: string, local: CurrencyCode): CurrencyCode | undefined {
  if (/^[A-Za-z]+$/.test(unit)) {
    const upper = unit.toUpperCase();
    if (isCurrencyCode(upper)) return upper;
    const word = ENGLISH[unit.toLowerCase()];
    return word ? resolve(word, local) : undefined;
  }
  const hit = SUFFIX_WORDS.find(([word]) => unit.startsWith(word));
  // "원"으로 시작하는 다른 낱말(원래, 원피스)은 통화가 아니다.
  if (!hit || (hit[0] === "원" && /^원(래|피스|하|해|가)/.test(unit))) return undefined;
  return resolve(hit[1], local);
}

/** "달러", "$"는 현지 통화가 달러 계열이면 그 통화로, 아니면 미국 달러로. "¥"는 중국이면 위안. */
function resolve(code: CurrencyCode | "dollar" | "yen", local: CurrencyCode): CurrencyCode {
  if (code === "dollar") return DOLLARS.includes(local) ? local : "USD";
  if (code === "yen") return local === "CNY" ? "CNY" : "JPY";
  return code;
}

function cleanTitle(raw: string) {
  let title = raw.replace(METHOD_WORDS, " ").replace(SPENT_WORDS, " ").replace(/\s+/g, " ").trim();
  title = title.replace(/^(?:for|on)\s+/i, "").replace(/[.!?~,]+$/, "").trim();
  // 끝의 조사만 뗀다: "택시로" → "택시", "점심에" → "점심"
  if (title.length > 2) title = title.replace(/(에서|으로|에|로|을|를)$/, "");
  return title.slice(0, 60).trim();
}

// ── 준비물 ─────────────────────────────────────────────

const NOT_PACKED = /(?:안|못)\s?챙|빼먹|빠뜨|두고\s?왔|깜빡|\bnot\b|forgot|忘れ/i;
const PACKED = /챙겼|챙김|넣었|쌌어|쌌음|쌌다|\bpacked\b|\bgot\b|入れた|持った/i;
const TO_PACK = /챙겨야|챙길|추가|사야|넣어야|\badd\b|\bneed\b|買う|持っていく|追加/i;

function readPacking(text: string, packing: PouchContext["packing"]): PouchIntent | undefined {
  const flat = squash(text);
  const item = [...packing].sort((a, b) => b.title.length - a.title.length).find((i) => squash(i.title) && flat.includes(squash(i.title)));
  if (item) {
    if (NOT_PACKED.test(text)) return { kind: "packed", itemId: item.id, done: false };
    if (PACKED.test(text)) return { kind: "packed", itemId: item.id, done: true };
    if (TO_PACK.test(text)) return { kind: "ask", topic: "pack" };
    return undefined;
  }
  const adding = TO_PACK.test(text), packedNew = PACKED.test(text) && !NOT_PACKED.test(text);
  if (!adding && !packedNew) return undefined;
  // 숫자가 있으면 지출일 수 있으니("우산 사야 해 15유로") 여기서 받지 않는다.
  if (/\d/.test(text)) return undefined;
  const title = packTitleOf(text);
  // "예약 추가", "일정 추가"는 준비물이 아니다.
  if (!title || title.length > 120 || TO_PACK.test(title) || PACKED.test(title) || /예약|일정|지출|경비|기록|reservation|booking|plan|expense/i.test(title)) return undefined;
  return { kind: "packAdd", title, done: packedNew && !adding };
}

/** 준비물 문장에서 물건 이름만 남긴다. "선크림도 꼭 챙겨야 해" → "선크림" */
export function packTitleOf(text: string) {
  return text
    .normalize("NFKC")
    .trim()
    .replace(/^(?:짐|준비물|가방)(?:에다?|목록에)?\s*/, "")
    .replace(/^(?:add|pack|need(?:\s+to\s+pack)?)\s+/i, "")
    .replace(/\s+to\s+(?:the\s+)?(?:list|packing)$/i, "")
    .replace(/\s*(?:도|을|를|은|는)?\s*(?:꼭\s*)?(?:챙겨야\s?(?:해|돼|함|겠다|지)?|챙길\s?(?:것|거)?|추가(?:해\s?줘|해|하기)?|사야\s?(?:해|돼|함)?|넣어야\s?(?:해|돼)?|챙겼어요?|챙김|넣었어요?|쌌어요?|쌌음|쌌다)\s*[.!?~]*$/, "")
    .replace(/(?:を)?(?:持っていく|追加|買う|入れた|持った)$/, "")
    .replace(/\s+(?:packed|got)$/i, "")
    .trim();
}

const squash = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
