import type { TripSettings } from "../../../src/domain/workspace/types";
import { starterTitles } from "./firstPage";
import { translate, type Key, type Lang } from "../i18n/strings";

export type Season = "spring" | "summer" | "autumn" | "winter";
type Climate = "temperate" | "tropical" | "dry" | "cold";

// 여행지 문자열과 시간대만 사용한다. 모르는 곳은 온대 규칙으로 두고 사용자가 목록을 고칠 수 있다.
const REGIONS: readonly { match: RegExp; hemisphere: "north" | "south"; climate: Climate }[] = [
  { match: /australia|new zealand|sydney|melbourne|auckland|호주|뉴질랜드|オーストラリア|ニュージーランド/i, hemisphere: "south", climate: "temperate" },
  { match: /brazil|argentina|chile|sao_paulo|buenos_aires|santiago|브라질|아르헨티나|칠레|ブラジル|アルゼンチン|チリ/i, hemisphere: "south", climate: "temperate" },
  { match: /south africa|cape_town|johannesburg|남아공|南アフリカ/i, hemisphere: "south", climate: "temperate" },
  { match: /thailand|singapore|vietnam|indonesia|malaysia|bangkok|jakarta|ho_chi_minh|태국|베트남|인도네시아|タイ|ベトナム|インドネシア/i, hemisphere: "north", climate: "tropical" },
  { match: /united arab emirates|uae|dubai|abu_dhabi|egypt|cairo|사막|두바이|ドバイ/i, hemisphere: "north", climate: "dry" },
  { match: /iceland|reykjavik|finland|helsinki|canada|toronto|아이슬란드|핀란드|カナダ|アイスランド/i, hemisphere: "north", climate: "cold" },
];

function region(destination: string | undefined, timeZone: string) {
  const value = `${destination ?? ""} ${timeZone}`;
  return REGIONS.find((entry) => entry.match.test(value)) ?? { hemisphere: "north" as const, climate: "temperate" as const };
}

/** 날짜의 양 끝을 포함한 여행 일수다. 예: 1월 1~3일은 3일. */
export function tripLengthDays(startDate: string, endDate: string): number {
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  return Number.isFinite(days) ? Math.max(1, days) : 1;
}

/** 현지 시작 달로 계절을 고른다. 남반구는 북반구보다 6개월 어긋난다. */
export function seasonForTrip(startDate: string, timeZone: string, destination?: string): Season {
  const month = Number(startDate.slice(5, 7));
  const shifted = region(destination, timeZone).hemisphere === "south" ? (month + 5) % 12 + 1 : month;
  return shifted <= 2 || shifted === 12 ? "winter" : shifted <= 5 ? "spring" : shifted <= 8 ? "summer" : "autumn";
}

const clean = (title: string) => title.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** 기본 목록, 현지 계절·기후, 이전 여행에서 미체크한 항목을 합친다. 기존 항목은 절대 변경하지 않는다. */
export function packingSuggestions(
  settings: Pick<TripSettings, "startDate" | "endDate" | "destination" | "timeZone" | "localCurrency">,
  lang: Lang,
  current: readonly { title: string }[],
  history: readonly { tripId: string; title: string; done: boolean }[],
  currentTripId?: string,
): string[] {
  const days = tripLengthDays(settings.startDate, settings.endDate);
  const season = seasonForTrip(settings.startDate, settings.timeZone, settings.destination);
  const climate = region(settings.destination, settings.timeZone).climate;
  const keys: Key[] = [];
  if (season === "winter" || climate === "cold") keys.push("autoPack.warm");
  else if (season === "spring" || season === "autumn") keys.push("autoPack.light");
  if (season === "summer" || climate === "tropical" || climate === "dry") keys.push("autoPack.sun");
  if (climate === "tropical" || (climate === "temperate" && season !== "winter")) keys.push("autoPack.rain");
  if (climate === "tropical" && season === "summer") keys.push("autoPack.swim");
  if (climate === "dry" || climate === "tropical") keys.push("autoPack.water");
  // 7벌이면 세탁을 전제로 같은 항목을 끝없이 늘리지 않는다.
  const clothes = days > 2 ? [translate(lang, "autoPack.clothes", { n: Math.min(days, 7) })] : [];
  const past = history.filter((item) => !item.done && item.tripId !== currentTripId).map((item) => item.title);
  const basics = starterTitles(settings, lang, current).filter((title) => days <= 2 || title !== translate(lang, "starter.clothes"));
  const candidates = [...basics, ...clothes, ...keys.map((key) => translate(lang, key)), ...past];
  const seen = new Set(current.map((item) => clean(item.title)));
  return candidates.filter((title) => {
    const normalized = clean(title);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, Math.max(0, 200 - current.length));
}
