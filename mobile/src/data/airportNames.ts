import { airports } from "../../../src/domain/reservations/confirmation";

// OCR이 굵은 글씨의 공항 코드를 자주 깨뜨린다(예: "(KIX)" → "(KIDX)", "(CJJ)" → "(CJ))").
// 같은 줄의 도시·공항 이름으로 후보 코드를 좁혀 고친다. 한국어 이름은 기존 공항 표에서 가져온다.
// 여기 없는 공항도 코드가 온전히 읽히면 그대로 쓴다. 이 표는 복구와 시간대 채우기에만 쓴다.
const names: Record<string, string[]> = {
  ICN: ["Incheon", "Seoul", "仁川", "ソウル"], GMP: ["Gimpo", "Seoul", "金浦", "ソウル"],
  PUS: ["Busan", "Gimhae", "釜山", "金海"], CJU: ["Jeju", "済州"], TAE: ["Daegu", "大邱"], CJJ: ["Cheongju", "清州"],
  NRT: ["Narita", "Tokyo", "成田", "東京"], HND: ["Haneda", "Tokyo", "羽田", "東京"],
  KIX: ["Kansai", "Osaka", "関西", "大阪"], ITM: ["Itami", "Osaka", "伊丹", "大阪"],
  NGO: ["Nagoya", "Chubu", "名古屋", "中部"], FUK: ["Fukuoka", "福岡"], CTS: ["Sapporo", "Chitose", "札幌", "千歳"],
  OKA: ["Okinawa", "Naha", "沖縄", "那覇"], KMJ: ["Kumamoto", "熊本"], KOJ: ["Kagoshima", "鹿児島"],
  PEK: ["Beijing", "北京"], PKX: ["Daxing", "Beijing", "大興", "北京"], PVG: ["Pudong", "Shanghai", "浦東", "上海"],
  SHA: ["Hongqiao", "Shanghai", "虹橋", "上海"], TPE: ["Taoyuan", "Taipei", "桃園", "台北"], TSA: ["Songshan", "Taipei", "台北"],
  HKG: ["Hong Kong", "香港"], MFM: ["Macau", "Macao", "マカオ", "澳門"], SIN: ["Singapore", "Changi", "シンガポール"],
  BKK: ["Bangkok", "Suvarnabhumi", "バンコク"], HKT: ["Phuket", "プーケット"], CNX: ["Chiang Mai", "チェンマイ"],
  DAD: ["Da Nang", "Danang", "ダナン"], SGN: ["Ho Chi Minh", "Tan Son Nhat", "ホーチミン"], HAN: ["Hanoi", "Noi Bai", "ハノイ"],
  CXR: ["Nha Trang", "Cam Ranh", "ニャチャン"], PQC: ["Phu Quoc", "フーコック"], MNL: ["Manila", "マニラ"], CEB: ["Cebu", "セブ"],
  DPS: ["Bali", "Denpasar", "バリ", "デンパサール"], KUL: ["Kuala Lumpur", "クアラルンプール"], BKI: ["Kota Kinabalu", "コタキナバル"],
  GUM: ["Guam", "グアム"], SPN: ["Saipan", "サイパン"], DXB: ["Dubai", "ドバイ"], IST: ["Istanbul", "イスタンブール"],
  LHR: ["Heathrow", "London", "ヒースロー", "ロンドン"], CDG: ["Charles de Gaulle", "Paris", "パリ"],
  FRA: ["Frankfurt", "フランクフルト"], MUC: ["Munich", "München", "ミュンヘン"], FCO: ["Fiumicino", "Rome", "Roma", "ローマ"],
  MXP: ["Malpensa", "Milan", "ミラノ"], BCN: ["Barcelona", "バルセロナ"], MAD: ["Madrid", "マドリード"],
  AMS: ["Schiphol", "Amsterdam", "アムステルダム"], ZRH: ["Zurich", "Zürich", "チューリッヒ"], PRG: ["Prague", "プラハ"],
  VIE: ["Vienna", "Wien", "ウィーン"], LAX: ["Los Angeles", "ロサンゼルス"], SFO: ["San Francisco", "サンフランシスコ"],
  SEA: ["Seattle", "シアトル"], LAS: ["Las Vegas", "ラスベガス"], JFK: ["Kennedy", "New York", "ニューヨーク"],
  EWR: ["Newark", "ニューアーク"], ATL: ["Atlanta", "アトランタ"], ORD: ["O'Hare", "Chicago", "シカゴ"],
  DFW: ["Dallas", "ダラス"], YVR: ["Vancouver", "バンクーバー"], YYZ: ["Toronto", "トロント"], HNL: ["Honolulu", "ホノルル"],
  SYD: ["Sydney", "シドニー"], MEL: ["Melbourne", "メルボルン"], BNE: ["Brisbane", "ブリスベン"], AKL: ["Auckland", "オークランド"],
};

// 한글·라틴 이름은 낱말 경계로만 찾는다("빈" 같은 한 글자 이름이 다른 낱말 안에서 맞지 않도록).
// 다만 "청주국제공항"처럼 붙여 쓴 공항 접미사는 허용한다. 일본어는 띄어쓰기가 없어 그대로 찾는다.
const aliases = Object.entries(airports).flatMap(([code, { city }]) =>
  [...city.split(/\s+/).filter(word => !/^[A-Z]{3}$/.test(word)), ...(names[code] ?? [])].map(name => {
    const source = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]/u.test(name)
      ? new RegExp(source, "u")
      : new RegExp(`(?<![\\p{L}\\p{N}])${source}(?!(?!(?:국제)?공항)[\\p{L}\\p{N}])`, "iu");
    return { code, pattern };
  }));

/** 글 안에 나온 도시·공항 이름에 맞는 코드 후보. */
export function airportCandidates(text: string): string[] {
  return [...new Set(aliases.filter(({ pattern }) => pattern.test(text)).map(({ code }) => code))];
}

export function airportTimeZone(code: string): string {
  return airports[code]?.timeZone ?? "";
}
