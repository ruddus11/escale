import type { CurrencyCode } from "../../../src/domain/money/types";
import type { Lang } from "../i18n/strings";

// 여행 도구 입력창 예시 금액. 여행지 통화로 적어야 일본 여행에 "12유로" 같은 예시가 뜨지 않는다.
// 금액은 그 나라 택시 기본요금·커피 한 잔쯤으로 어림했다. 표에 없는 통화는 유로와 비슷한 크기로 두고 통화 코드를 붙인다.
const AMOUNTS: Partial<Record<CurrencyCode, [taxi: number, coffee: number]>> = {
  JPY: [1500, 500],
  KRW: [15000, 5000],
  EUR: [12, 3.5],
  USD: [15, 5],
  GBP: [12, 3.5],
  CNY: [30, 25],
  THB: [150, 80],
  TWD: [200, 100],
  HKD: [80, 40],
  VND: [100000, 50000],
};

// 통화 이름은 pouchIntents가 다시 읽을 수 있는 말만 쓴다. 한국어·일본어는 숫자에 붙이고, 영어는 띄운다.
const WORDS: Partial<Record<CurrencyCode, { ko: string; en: string; ja: string }>> = {
  JPY: { ko: "엔", en: "yen", ja: "円" },
  KRW: { ko: "원", en: "won", ja: "ウォン" },
  EUR: { ko: "유로", en: "euros", ja: "ユーロ" },
  USD: { ko: "달러", en: "dollars", ja: "ドル" },
  GBP: { ko: "파운드", en: "pounds", ja: "ポンド" },
  CNY: { ko: "위안", en: "yuan", ja: "元" },
  THB: { ko: "바트", en: "baht", ja: "バーツ" },
  VND: { ko: "동", en: "dong", ja: "VND" },
};

export function spendExamples(local: CurrencyCode, lang: Lang) {
  const [taxi, coffee] = AMOUNTS[local] ?? [12, 3.5];
  const words = WORDS[local];
  const key = lang === "ko" ? "ko" : lang === "ja" ? "ja" : "en";
  const word = words?.[key];
  const attach = !!word && key !== "en" && word !== local;
  const money = (n: number) => (attach ? `${n}${word}` : `${n} ${word ?? local}`);
  return { taxi: money(taxi), coffee: money(coffee) };
}
