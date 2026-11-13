// 여권 도장의 나라별 디자인 자료. 나라마다 모양과 잉크색을 다르게 둬 도장이 쌓여도 서로 구별된다.
// 실제 도장 그림은 assets/stamps/<code>.png로 넣고 stampArt에 연결한다.
// 그림이 없는 나라는 Stamp 컴포넌트가 이 자료(모양·색·이름·도시·날짜)로 그린 대체 도장을 쓴다.

export type StampShape = "circle" | "oval" | "rect" | "hexagon" | "octagon" | "diamond" | "arch";

export interface StampCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: { ko: string; en: string; ja: string };
  shape: StampShape;
  /** 잉크색. 흰 여권 면 위에서 4.5:1 이상. */
  ink: string;
  /** 이 나라로 읽는 IANA 시간대 */
  zones: string[];
}

// 잉크는 바랜 인주처럼 채도를 낮춘다. 같은 색이 이웃 나라에 몰리지 않게 섞어 둔다.
const INK = { teal: "#0F5560", red: "#A33A2C", navy: "#24407A", plum: "#6B3A6E", olive: "#4F5B1E", brown: "#7A4A1E", slate: "#3D4A5C", green: "#1F6142" } as const;

export const STAMP_COUNTRIES: StampCountry[] = [
  { code: "KR", name: { ko: "대한민국", en: "Korea", ja: "韓国" }, shape: "circle", ink: INK.navy, zones: ["Asia/Seoul"] },
  { code: "JP", name: { ko: "일본", en: "Japan", ja: "日本" }, shape: "circle", ink: INK.red, zones: ["Asia/Tokyo"] },
  { code: "TW", name: { ko: "대만", en: "Taiwan", ja: "台湾" }, shape: "octagon", ink: INK.green, zones: ["Asia/Taipei"] },
  { code: "CN", name: { ko: "중국", en: "China", ja: "中国" }, shape: "rect", ink: INK.red, zones: ["Asia/Shanghai", "Asia/Chongqing", "Asia/Harbin", "Asia/Urumqi"] },
  { code: "HK", name: { ko: "홍콩", en: "Hong Kong", ja: "香港" }, shape: "hexagon", ink: INK.plum, zones: ["Asia/Hong_Kong"] },
  { code: "MO", name: { ko: "마카오", en: "Macao", ja: "マカオ" }, shape: "oval", ink: INK.green, zones: ["Asia/Macau"] },
  { code: "TH", name: { ko: "태국", en: "Thailand", ja: "タイ" }, shape: "arch", ink: INK.plum, zones: ["Asia/Bangkok"] },
  { code: "VN", name: { ko: "베트남", en: "Vietnam", ja: "ベトナム" }, shape: "diamond", ink: INK.red, zones: ["Asia/Ho_Chi_Minh", "Asia/Saigon"] },
  { code: "SG", name: { ko: "싱가포르", en: "Singapore", ja: "シンガポール" }, shape: "rect", ink: INK.teal, zones: ["Asia/Singapore"] },
  { code: "MY", name: { ko: "말레이시아", en: "Malaysia", ja: "マレーシア" }, shape: "oval", ink: INK.navy, zones: ["Asia/Kuala_Lumpur", "Asia/Kuching"] },
  { code: "PH", name: { ko: "필리핀", en: "Philippines", ja: "フィリピン" }, shape: "hexagon", ink: INK.teal, zones: ["Asia/Manila"] },
  { code: "ID", name: { ko: "인도네시아", en: "Indonesia", ja: "インドネシア" }, shape: "arch", ink: INK.brown, zones: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Pontianak"] },
  { code: "KH", name: { ko: "캄보디아", en: "Cambodia", ja: "カンボジア" }, shape: "arch", ink: INK.olive, zones: ["Asia/Phnom_Penh"] },
  { code: "LA", name: { ko: "라오스", en: "Laos", ja: "ラオス" }, shape: "circle", ink: INK.green, zones: ["Asia/Vientiane"] },
  { code: "MN", name: { ko: "몽골", en: "Mongolia", ja: "モンゴル" }, shape: "circle", ink: INK.navy, zones: ["Asia/Ulaanbaatar"] },
  { code: "IN", name: { ko: "인도", en: "India", ja: "インド" }, shape: "octagon", ink: INK.brown, zones: ["Asia/Kolkata", "Asia/Calcutta"] },
  { code: "NP", name: { ko: "네팔", en: "Nepal", ja: "ネパール" }, shape: "diamond", ink: INK.red, zones: ["Asia/Kathmandu"] },
  { code: "AE", name: { ko: "아랍에미리트", en: "UAE", ja: "アラブ首長国連邦" }, shape: "hexagon", ink: INK.brown, zones: ["Asia/Dubai"] },
  { code: "TR", name: { ko: "튀르키예", en: "Türkiye", ja: "トルコ" }, shape: "oval", ink: INK.red, zones: ["Europe/Istanbul"] },
  { code: "GB", name: { ko: "영국", en: "United Kingdom", ja: "イギリス" }, shape: "rect", ink: INK.navy, zones: ["Europe/London"] },
  { code: "IE", name: { ko: "아일랜드", en: "Ireland", ja: "アイルランド" }, shape: "circle", ink: INK.green, zones: ["Europe/Dublin"] },
  { code: "FR", name: { ko: "프랑스", en: "France", ja: "フランス" }, shape: "oval", ink: INK.navy, zones: ["Europe/Paris"] },
  { code: "IT", name: { ko: "이탈리아", en: "Italy", ja: "イタリア" }, shape: "arch", ink: INK.green, zones: ["Europe/Rome"] },
  { code: "ES", name: { ko: "스페인", en: "Spain", ja: "スペイン" }, shape: "octagon", ink: INK.red, zones: ["Europe/Madrid", "Atlantic/Canary"] },
  { code: "PT", name: { ko: "포르투갈", en: "Portugal", ja: "ポルトガル" }, shape: "hexagon", ink: INK.teal, zones: ["Europe/Lisbon"] },
  { code: "DE", name: { ko: "독일", en: "Germany", ja: "ドイツ" }, shape: "rect", ink: INK.slate, zones: ["Europe/Berlin"] },
  { code: "NL", name: { ko: "네덜란드", en: "Netherlands", ja: "オランダ" }, shape: "diamond", ink: INK.brown, zones: ["Europe/Amsterdam"] },
  { code: "BE", name: { ko: "벨기에", en: "Belgium", ja: "ベルギー" }, shape: "circle", ink: INK.slate, zones: ["Europe/Brussels"] },
  { code: "CH", name: { ko: "스위스", en: "Switzerland", ja: "スイス" }, shape: "rect", ink: INK.red, zones: ["Europe/Zurich"] },
  { code: "AT", name: { ko: "오스트리아", en: "Austria", ja: "オーストリア" }, shape: "octagon", ink: INK.plum, zones: ["Europe/Vienna"] },
  { code: "CZ", name: { ko: "체코", en: "Czechia", ja: "チェコ" }, shape: "arch", ink: INK.navy, zones: ["Europe/Prague"] },
  { code: "HU", name: { ko: "헝가리", en: "Hungary", ja: "ハンガリー" }, shape: "hexagon", ink: INK.green, zones: ["Europe/Budapest"] },
  { code: "GR", name: { ko: "그리스", en: "Greece", ja: "ギリシャ" }, shape: "circle", ink: INK.teal, zones: ["Europe/Athens"] },
  { code: "HR", name: { ko: "크로아티아", en: "Croatia", ja: "クロアチア" }, shape: "diamond", ink: INK.navy, zones: ["Europe/Zagreb"] },
  { code: "DK", name: { ko: "덴마크", en: "Denmark", ja: "デンマーク" }, shape: "oval", ink: INK.red, zones: ["Europe/Copenhagen"] },
  { code: "SE", name: { ko: "스웨덴", en: "Sweden", ja: "スウェーデン" }, shape: "circle", ink: INK.navy, zones: ["Europe/Stockholm"] },
  { code: "NO", name: { ko: "노르웨이", en: "Norway", ja: "ノルウェー" }, shape: "arch", ink: INK.slate, zones: ["Europe/Oslo"] },
  { code: "FI", name: { ko: "핀란드", en: "Finland", ja: "フィンランド" }, shape: "hexagon", ink: INK.navy, zones: ["Europe/Helsinki"] },
  { code: "IS", name: { ko: "아이슬란드", en: "Iceland", ja: "アイスランド" }, shape: "octagon", ink: INK.teal, zones: ["Atlantic/Reykjavik"] },
  { code: "EG", name: { ko: "이집트", en: "Egypt", ja: "エジプト" }, shape: "arch", ink: INK.brown, zones: ["Africa/Cairo"] },
  { code: "ZA", name: { ko: "남아공", en: "South Africa", ja: "南アフリカ" }, shape: "hexagon", ink: INK.olive, zones: ["Africa/Johannesburg"] },
  { code: "US", name: { ko: "미국", en: "United States", ja: "アメリカ" }, shape: "rect", ink: INK.navy, zones: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"] },
  { code: "GU", name: { ko: "괌", en: "Guam", ja: "グアム" }, shape: "oval", ink: INK.teal, zones: ["Pacific/Guam"] },
  { code: "MP", name: { ko: "사이판", en: "Saipan", ja: "サイパン" }, shape: "circle", ink: INK.teal, zones: ["Pacific/Saipan"] },
  { code: "CA", name: { ko: "캐나다", en: "Canada", ja: "カナダ" }, shape: "octagon", ink: INK.red, zones: ["America/Toronto", "America/Vancouver", "America/Montreal", "America/Edmonton", "America/Halifax", "America/Winnipeg"] },
  { code: "MX", name: { ko: "멕시코", en: "Mexico", ja: "メキシコ" }, shape: "diamond", ink: INK.green, zones: ["America/Mexico_City", "America/Cancun"] },
  { code: "BR", name: { ko: "브라질", en: "Brazil", ja: "ブラジル" }, shape: "circle", ink: INK.green, zones: ["America/Sao_Paulo"] },
  { code: "AU", name: { ko: "호주", en: "Australia", ja: "オーストラリア" }, shape: "hexagon", ink: INK.brown, zones: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide", "Australia/Darwin", "Australia/Hobart"] },
  { code: "NZ", name: { ko: "뉴질랜드", en: "New Zealand", ja: "ニュージーランド" }, shape: "arch", ink: INK.slate, zones: ["Pacific/Auckland"] },
];

const byZone = new Map(STAMP_COUNTRIES.flatMap((c) => c.zones.map((zone) => [zone, c] as const)));
const byCode = new Map(STAMP_COUNTRIES.map((c) => [c.code, c] as const));

export function countryForZone(zone: string): StampCountry | undefined {
  return byZone.get(zone);
}
export function stampCountry(code: string): StampCountry | undefined {
  return byCode.get(code);
}
