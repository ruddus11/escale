import bundledTimeZones from "./timeZones.json";
import { CURRENCY_DIGITS } from "../../../src/domain/money/currency";
import type { CurrencyCode } from "../../../src/domain/money/types";
import type { Lang } from "../i18n/strings";
export interface SelectOption {value:string;label:string;search?:string}
// [한국어, English, 日本語]. 검색은 세 언어 이름과 코드를 모두 받는다.
const names: Record<CurrencyCode, readonly [string, string, string]> = {
  KRW: ["대한민국 원", "South Korean won", "韓国ウォン"], JPY: ["일본 엔", "Japanese yen", "日本円"],
  USD: ["미국 달러", "US dollar", "米ドル"], EUR: ["유로", "Euro", "ユーロ"], GBP: ["영국 파운드", "British pound", "英ポンド"],
  CNY: ["중국 위안", "Chinese yuan", "人民元"], TWD: ["대만 달러", "New Taiwan dollar", "台湾ドル"], HKD: ["홍콩 달러", "Hong Kong dollar", "香港ドル"],
  SGD: ["싱가포르 달러", "Singapore dollar", "シンガポールドル"], THB: ["태국 바트", "Thai baht", "タイバーツ"], VND: ["베트남 동", "Vietnamese dong", "ベトナムドン"],
  AUD: ["호주 달러", "Australian dollar", "豪ドル"], CAD: ["캐나다 달러", "Canadian dollar", "カナダドル"], CHF: ["스위스 프랑", "Swiss franc", "スイスフラン"],
  NZD: ["뉴질랜드 달러", "New Zealand dollar", "ニュージーランドドル"], IDR: ["인도네시아 루피아", "Indonesian rupiah", "インドネシアルピア"],
  MYR: ["말레이시아 링깃", "Malaysian ringgit", "マレーシアリンギット"], PHP: ["필리핀 페소", "Philippine peso", "フィリピンペソ"],
  INR: ["인도 루피", "Indian rupee", "インドルピー"], AED: ["아랍에미리트 디르함", "UAE dirham", "UAEディルハム"], KWD: ["쿠웨이트 디나르", "Kuwaiti dinar", "クウェートディナール"],
};
const nameIndex = (lang: Lang) => (lang === "ko" ? 0 : lang === "ja" ? 2 : 1);

export function currencyOptions(lang: Lang = "ko"): SelectOption[] {
  return (Object.keys(CURRENCY_DIGITS) as CurrencyCode[]).map((value) => ({ value, label: `${names[value][nameIndex(lang)]} · ${value}`, search: names[value].join(" ") }));
}

// 자주 가는 곳의 도시 이름. 없는 시간대는 영문 도시명을 쓴다.
const cities: Record<string, readonly [string, string, string]> = {
  "Asia/Seoul": ["서울 · 대한민국", "Seoul · South Korea", "ソウル · 韓国"],
  "Asia/Tokyo": ["도쿄 · 일본 · 오사카", "Tokyo · Japan · Osaka", "東京 · 日本 · 大阪"],
  "Asia/Shanghai": ["상하이 · 중국 · 베이징", "Shanghai · China · Beijing", "上海 · 中国 · 北京"],
  "Asia/Taipei": ["타이베이 · 대만", "Taipei · Taiwan", "台北 · 台湾"],
  "Asia/Hong_Kong": ["홍콩", "Hong Kong", "香港"],
  "Asia/Singapore": ["싱가포르", "Singapore", "シンガポール"],
  "Asia/Bangkok": ["방콕 · 태국", "Bangkok · Thailand", "バンコク · タイ"],
  "Asia/Ho_Chi_Minh": ["호찌민 · 베트남 · 하노이", "Ho Chi Minh City · Vietnam · Hanoi", "ホーチミン · ベトナム · ハノイ"],
  "Asia/Dubai": ["두바이", "Dubai", "ドバイ"],
  "Asia/Kolkata": ["콜카타 · 인도", "Kolkata · India", "コルカタ · インド"],
  "Europe/London": ["런던 · 영국", "London · UK", "ロンドン · イギリス"],
  "Europe/Paris": ["파리 · 프랑스", "Paris · France", "パリ · フランス"],
  "Europe/Rome": ["로마 · 이탈리아", "Rome · Italy", "ローマ · イタリア"],
  "Europe/Berlin": ["베를린 · 독일", "Berlin · Germany", "ベルリン · ドイツ"],
  "Europe/Madrid": ["마드리드 · 스페인", "Madrid · Spain", "マドリード · スペイン"],
  "Europe/Lisbon": ["리스본 · 포르투갈", "Lisbon · Portugal", "リスボン · ポルトガル"],
  "America/New_York": ["뉴욕 · 미국 동부", "New York · US East", "ニューヨーク · 米国東部"],
  "America/Los_Angeles": ["로스앤젤레스 · 미국 서부", "Los Angeles · US West", "ロサンゼルス · 米国西部"],
  "America/Chicago": ["시카고", "Chicago", "シカゴ"],
  "America/Vancouver": ["밴쿠버", "Vancouver", "バンクーバー"],
  "America/Toronto": ["토론토", "Toronto", "トロント"],
  "America/Sao_Paulo": ["상파울루 · 브라질", "São Paulo · Brazil", "サンパウロ · ブラジル"],
  "Pacific/Honolulu": ["호놀룰루 · 하와이", "Honolulu · Hawaii", "ホノルル · ハワイ"],
  "Pacific/Auckland": ["오클랜드 · 뉴질랜드", "Auckland · New Zealand", "オークランド · ニュージーランド"],
  "Australia/Sydney": ["시드니 · 호주", "Sydney · Australia", "シドニー · オーストラリア"],
  "Australia/Perth": ["퍼스 · 호주", "Perth · Australia", "パース · オーストラリア"],
  "Africa/Cairo": ["카이로 · 이집트", "Cairo · Egypt", "カイロ · エジプト"],
  "Africa/Johannesburg": ["요하네스버그 · 남아공", "Johannesburg · South Africa", "ヨハネスブルグ · 南アフリカ"],
  UTC: ["협정 세계시", "Coordinated Universal Time", "協定世界時"],
};
/** 시간대의 대표 도시 이름. 별칭이 없으면 영문 도시명을 쓴다. */
export function zoneCity(zone: string, lang: Lang = "ko") {
  return cities[zone]?.[nameIndex(lang)].split(" · ")[0] ?? zone.split("/").pop()!.replaceAll("_", " ");
}
export function timeZoneOptions(current: string, lang: Lang = "ko"): SelectOption[] {
  let supported: string[] = [];
  try {supported=(Intl as typeof Intl & {supportedValuesOf?:(key:string)=>string[]}).supportedValuesOf?.("timeZone") ?? [];} catch { /* 기기 지원 목록이 없으면 기본 목록과 기존 값을 유지한다. */ }
  return [...new Set([current, ...Object.keys(cities), ...bundledTimeZones, ...supported])]
    .filter(Boolean)
    .map((value) => ({ value, label: cities[value] ? `${cities[value][nameIndex(lang)]} · ${value}` : value.replaceAll("_", " "), search: cities[value]?.join(" ") }));
}
export function searchOptions(options:SelectOption[],query:string) {
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return options.filter(o=>words.every(w=>`${o.label} ${o.value} ${o.search ?? ""}`.toLocaleLowerCase().includes(w)));
}
