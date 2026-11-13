import { expect, it } from "vitest";
import { CURRENCY_DIGITS } from "../../src/domain/money/currency";
import { localCurrencyAfterZoneChange, suggestCurrencyForZone } from "../src/data/zoneCurrency";
import bundledTimeZones from "../src/data/timeZones.json";

it("suggests the local currency for common destinations", () => {
  expect(suggestCurrencyForZone("Asia/Tokyo")).toBe("JPY");
  expect(suggestCurrencyForZone("Europe/Paris")).toBe("EUR");
  expect(suggestCurrencyForZone("Europe/Sofia")).toBe("EUR");
  expect(suggestCurrencyForZone("America/New_York")).toBe("USD");
  expect(suggestCurrencyForZone("Asia/Seoul")).toBe("KRW");
  expect(suggestCurrencyForZone("Asia/Shanghai")).toBe("CNY");
  expect(suggestCurrencyForZone("Asia/Taipei")).toBe("TWD");
  expect(suggestCurrencyForZone("Asia/Hong_Kong")).toBe("HKD");
  expect(suggestCurrencyForZone("Asia/Singapore")).toBe("SGD");
  expect(suggestCurrencyForZone("Asia/Bangkok")).toBe("THB");
  expect(suggestCurrencyForZone("Asia/Jakarta")).toBe("IDR");
  expect(suggestCurrencyForZone("Asia/Kuala_Lumpur")).toBe("MYR");
  expect(suggestCurrencyForZone("Asia/Manila")).toBe("PHP");
  expect(suggestCurrencyForZone("Asia/Calcutta")).toBe("INR");
  expect(suggestCurrencyForZone("Asia/Kuwait")).toBe("KWD");
  expect(suggestCurrencyForZone("Europe/London")).toBe("GBP");
  expect(suggestCurrencyForZone("Europe/Zurich")).toBe("CHF");
  expect(suggestCurrencyForZone("Asia/Ho_Chi_Minh")).toBe("VND");
  expect(suggestCurrencyForZone("Asia/Saigon")).toBe("VND");
  expect(suggestCurrencyForZone("Asia/Dubai")).toBe("AED");
  expect(suggestCurrencyForZone("Australia/Perth")).toBe("AUD");
  expect(suggestCurrencyForZone("Indian/Christmas")).toBe("AUD");
  expect(suggestCurrencyForZone("Indian/Cocos")).toBe("AUD");
  expect(suggestCurrencyForZone("Pacific/Auckland")).toBe("NZD");
  expect(suggestCurrencyForZone("America/Vancouver")).toBe("CAD");
  expect(suggestCurrencyForZone("Pacific/Honolulu")).toBe("USD");
  expect(suggestCurrencyForZone("Atlantic/Canary")).toBe("EUR");
});

it("gives no suggestion for unknown or unsupported-currency zones", () => {
  expect(suggestCurrencyForZone("Mars/Olympus_Mons")).toBeUndefined();
  expect(suggestCurrencyForZone("")).toBeUndefined();
  expect(suggestCurrencyForZone("UTC")).toBeUndefined();
  expect(suggestCurrencyForZone("toString")).toBeUndefined();
  // 레알·이집트 파운드·튀르키예 리라는 앱이 지원하지 않는다.
  expect(suggestCurrencyForZone("America/Sao_Paulo")).toBeUndefined();
  expect(suggestCurrencyForZone("Africa/Cairo")).toBeUndefined();
  expect(suggestCurrencyForZone("Europe/Istanbul")).toBeUndefined();
  // 북키프로스는 튀르키예 리라를 쓰므로 EUR를 추천하면 안 된다.
  expect(suggestCurrencyForZone("Asia/Famagusta")).toBeUndefined();
});

it("only suggests supported currencies, including the bundled legacy zone names", () => {
  const supported = Object.keys(CURRENCY_DIGITS);
  for (const zone of bundledTimeZones) {
    const currency = suggestCurrencyForZone(zone);
    if (currency) expect(supported).toContain(currency);
  }
  // 번들 목록은 Asia/Calcutta·America/Indianapolis 같은 옛 이름을 쓴다.
  expect(suggestCurrencyForZone("Asia/Calcutta")).toBe("INR");
  expect(suggestCurrencyForZone("America/Indianapolis")).toBe("USD");
});

it("follows the time zone until the user picks a currency", () => {
  expect(localCurrencyAfterZoneChange("Asia/Tokyo", "KRW", false)).toBe("JPY");
  expect(localCurrencyAfterZoneChange("Europe/Paris", "JPY", false)).toBe("EUR");
  expect(localCurrencyAfterZoneChange("Europe/Paris", "GBP", true)).toBe("GBP");
  expect(localCurrencyAfterZoneChange("Mars/Olympus_Mons", "JPY", false)).toBe("JPY");
  expect(localCurrencyAfterZoneChange("Asia/Famagusta", "JPY", false)).toBe("JPY");
  expect(localCurrencyAfterZoneChange("Europe/Sofia", "GBP", true)).toBe("GBP");
});
