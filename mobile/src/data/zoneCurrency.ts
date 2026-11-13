import type { CurrencyCode } from "../../../src/domain/money/types";

// 앱이 지원하는 21개 통화(CURRENCY_DIGITS)로만 추천한다. 브라질 레알·튀르키예 리라처럼
// 지원하지 않는 통화를 쓰는 지역은 일부러 빼서, 엉뚱한 통화 대신 현재 값을 유지하게 한다.
const euroZones = [
  "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid", "Europe/Lisbon", "Europe/Amsterdam",
  "Europe/Brussels", "Europe/Vienna", "Europe/Athens", "Europe/Dublin", "Europe/Helsinki", "Europe/Luxembourg",
  "Europe/Monaco", "Europe/Vatican", "Europe/San_Marino", "Europe/Andorra", "Europe/Malta", "Europe/Bratislava",
  "Europe/Ljubljana", "Europe/Zagreb", "Europe/Tallinn", "Europe/Riga", "Europe/Vilnius", "Europe/Podgorica",
  "Asia/Nicosia", "Europe/Nicosia", "Europe/Sofia", "Atlantic/Madeira", "Atlantic/Azores", "Atlantic/Canary",
  "Africa/Ceuta", "Europe/Mariehamn", "America/Guadeloupe", "America/Martinique", "America/Cayenne",
  "America/St_Barthelemy", "America/Marigot", "America/Miquelon", "Indian/Reunion", "Indian/Mayotte",
] as const;
const usdZones = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "America/Detroit", "America/Boise", "America/Indiana/Indianapolis", "America/Kentucky/Louisville",
  "America/Juneau", "America/Adak", "America/Puerto_Rico", "America/St_Thomas", "America/Guayaquil",
  "America/El_Salvador", "America/Panama", "Pacific/Honolulu", "Pacific/Guam", "Pacific/Saipan",
  "Pacific/Pago_Pago", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "US/Hawaii",
  "America/Indianapolis", "America/Louisville", "America/Indiana/Knox", "America/Indiana/Marengo",
  "America/Indiana/Petersburg", "America/Indiana/Tell_City", "America/Indiana/Vevay", "America/Indiana/Vincennes",
  "America/Indiana/Winamac", "America/Kentucky/Monticello", "America/North_Dakota/Beulah", "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem", "America/Menominee", "America/Metlakatla", "America/Nome", "America/Sitka",
  "America/Yakutat", "America/Tortola", "America/Kralendijk", "America/Grand_Turk", "Pacific/Midway", "Pacific/Wake",
  "Pacific/Kwajalein", "Pacific/Majuro", "Pacific/Palau", "Pacific/Ponape", "Pacific/Kosrae", "Pacific/Truk",
  "Pacific/Galapagos", "Asia/Dili",
] as const;

const zoneCurrency = new Map<string, CurrencyCode>(Object.entries({
  ...Object.fromEntries(euroZones.map((zone) => [zone, "EUR"])),
  ...Object.fromEntries(usdZones.map((zone) => [zone, "USD"])),
  "Asia/Seoul": "KRW", "ROK": "KRW",
  "Asia/Tokyo": "JPY", "Japan": "JPY",
  "Asia/Shanghai": "CNY", "Asia/Urumqi": "CNY", "Asia/Chongqing": "CNY", "Asia/Harbin": "CNY", "PRC": "CNY",
  "Asia/Taipei": "TWD", "ROC": "TWD",
  "Asia/Hong_Kong": "HKD", "Hongkong": "HKD",
  "Asia/Singapore": "SGD", "Singapore": "SGD",
  "Asia/Bangkok": "THB",
  "Asia/Ho_Chi_Minh": "VND", "Asia/Saigon": "VND",
  "Asia/Jakarta": "IDR", "Asia/Makassar": "IDR", "Asia/Jayapura": "IDR", "Asia/Pontianak": "IDR",
  "Asia/Kuala_Lumpur": "MYR", "Asia/Kuching": "MYR",
  "Asia/Manila": "PHP",
  "Asia/Kolkata": "INR", "Asia/Calcutta": "INR",
  "Asia/Dubai": "AED",
  "Asia/Kuwait": "KWD",
  "Europe/London": "GBP", "Europe/Belfast": "GBP", "GB": "GBP",
  "Europe/Jersey": "GBP", "Europe/Guernsey": "GBP", "Europe/Isle_of_Man": "GBP",
  "Europe/Zurich": "CHF", "Europe/Vaduz": "CHF",
  "America/Toronto": "CAD", "America/Vancouver": "CAD", "America/Montreal": "CAD", "America/Edmonton": "CAD",
  "America/Winnipeg": "CAD", "America/Halifax": "CAD", "America/St_Johns": "CAD", "America/Regina": "CAD",
  "America/Moncton": "CAD", "America/Glace_Bay": "CAD", "America/Goose_Bay": "CAD", "America/Iqaluit": "CAD",
  "America/Rankin_Inlet": "CAD", "America/Resolute": "CAD", "America/Cambridge_Bay": "CAD", "America/Inuvik": "CAD",
  "America/Whitehorse": "CAD", "America/Dawson": "CAD", "America/Dawson_Creek": "CAD", "America/Fort_Nelson": "CAD",
  "America/Creston": "CAD", "America/Swift_Current": "CAD", "America/Blanc-Sablon": "CAD", "America/Coral_Harbour": "CAD",
  "Australia/Sydney": "AUD", "Australia/Melbourne": "AUD", "Australia/Brisbane": "AUD", "Australia/Perth": "AUD",
  "Australia/Adelaide": "AUD", "Australia/Darwin": "AUD", "Australia/Hobart": "AUD", "Australia/Canberra": "AUD",
  "Australia/Lord_Howe": "AUD", "Australia/Broken_Hill": "AUD", "Australia/Eucla": "AUD", "Australia/Lindeman": "AUD",
  "Pacific/Norfolk": "AUD", "Indian/Christmas": "AUD", "Indian/Cocos": "AUD",
  "Pacific/Nauru": "AUD", "Pacific/Tarawa": "AUD", "Pacific/Enderbury": "AUD",
  "Pacific/Kiritimati": "AUD", "Pacific/Funafuti": "AUD",
  "Pacific/Auckland": "NZD", "Pacific/Chatham": "NZD", "NZ": "NZD",
  "Pacific/Rarotonga": "NZD", "Pacific/Niue": "NZD", "Pacific/Pitcairn": "NZD", "Pacific/Fakaofo": "NZD",
} as Record<string, CurrencyCode>));

/** 현지 시간대에 맞는 통화. 모르거나 지원하지 않는 통화를 쓰는 시간대면 undefined. */
export function suggestCurrencyForZone(zone: string): CurrencyCode | undefined {
  return zoneCurrency.get(zone);
}

/** 시간대가 바뀐 뒤의 현지 통화. 사용자가 직접 고른 통화는 덮어쓰지 않는다. */
export function localCurrencyAfterZoneChange(zone: string, current: CurrencyCode, pickedByUser: boolean): CurrencyCode {
  return pickedByUser ? current : suggestCurrencyForZone(zone) ?? current;
}
