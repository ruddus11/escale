import { describe, expect, it, vi } from "vitest";
import { createPlaceBrowser, weeklyHours } from "./browsePlaces";

const cafe = { id: "ChIJ0000000000", displayName: { text: "Real café" }, formattedAddress: "Seoul", types: ["cafe"], primaryType: "cafe", rating: 4.4, userRatingCount: 27 };
// 니시카사이 숙소 근처 카페 1·2위로 나온 맥도날드처럼 보조 유형에 cafe가 붙은 패스트푸드점.
const fastFood = { ...cafe, id: "ChIJ3333333333", displayName: { text: "McDonald's" }, types: ["fast_food_restaurant", "hamburger_restaurant", "cafe", "restaurant"], primaryType: "fast_food_restaurant" };
const burger = { ...cafe, id: "ChIJ4444444444", displayName: { text: "Burger shop" }, types: ["hamburger_restaurant", "cafe"], primaryType: "hamburger_restaurant" };
const coffeeShop = { ...cafe, id: "ChIJ5555555555", displayName: { text: "Coffee shop" }, types: ["coffee_shop", "cafe"], primaryType: "coffee_shop" };
const cafeWithBurgers = { ...cafe, id: "ChIJ6666666666", displayName: { text: "Café serving burgers" }, types: ["cafe", "fast_food_restaurant"], primaryType: "cafe" };
// 니시카사이 숙소 근처 카페에 섞여 나온 곳들. 보조 유형에만 cafe가 붙어 있다.
const italian = { ...cafe, id: "ChIJ7777777777", displayName: { text: "Italian Kitchen VANSAN" }, types: ["italian_restaurant", "cafe", "restaurant"], primaryType: "italian_restaurant" };
const deli = { ...cafe, id: "ChIJ8888888888", displayName: { text: "Deli" }, types: ["deli", "cafe"], primaryType: "deli" };
const hotel = { ...cafe, id: "ChIJ9999999999", displayName: { text: "7 Rooms Hotel & Cafe" }, types: ["hotel", "cafe", "lodging"], primaryType: "hotel" };
// 빵집은 카드에 "빵집"으로 보여 카페로 치지 않는다. 대표 유형이 없으면 Google이 지원하지 않는 유형이 대표라는 뜻이다.
const bakery = { ...cafe, id: "ChIJbakery0000", displayName: { text: "Bakery with seats" }, types: ["bakery", "cafe"], primaryType: "bakery" };
const unknownMain = { ...cafe, id: "ChIJunknown000", displayName: { text: "Unknown main type" }, primaryType: undefined };
const notCafes = [italian, { ...italian, id: "ChIJ7777777778" }, deli, hotel, bakery, unknownMain];
const cafeKinds = ["coffee_roastery", "coffee_stand", "tea_house", "cat_cafe", "dog_cafe"].map(type => ({ ...cafe, id: `ChIJ${type}`, displayName: { text: type }, types: [type, "cafe"], primaryType: type }));
const cafeNames = ["Coffee shop", "coffee_roastery", "coffee_stand", "tea_house", "cat_cafe", "dog_cafe", "Real café"];
describe("category place browsing", () => {
  it("records only provider status codes without search text, keys or raw messages", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const fetchImpl = vi.fn().mockResolvedValue(Response.json({ error: { status: "PERMISSION_DENIED", message: "private-search secret", details: [{ reason: "BILLING_DISABLED", metadata: { key: "secret" } }, { reason: "private-search" }] } }, { status: 403 }));
      await expect(createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "private-search", category: "cafe", language: "ko" })).rejects.toThrow("UPSTREAM_PROVIDER_ERROR");
      expect(log).toHaveBeenCalledWith("PLACE_BROWSE_PROVIDER_ERROR", { operation: "search", httpStatus: 403, status: "PERMISSION_DENIED", reasons: ["BILLING_DISABLED"], configuration: "UNKNOWN", hints: [] });
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|private-search/);
    } finally { log.mockRestore(); }
  });
  it("keeps fixed configuration words but drops arbitrary identifiers and search text", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const fetchImpl = vi.fn().mockResolvedValue(Response.json({ error: { status: "PERMISSION_DENIED", message: "Method doesn't allow unregistered callers without established identity. SecretHotel secret-key 35.664 139.859 user@example.test https://private.test" } }, { status: 403 }));
      await expect(createPlaceBrowser({ apiKey: "secret-key", fetch: fetchImpl })({ destination: "SecretHotel", category: "cafe", language: "ko" })).rejects.toThrow();
      expect(log.mock.calls[0][1]).toMatchObject({ hints: ["unregistered", "callers", "without", "established", "identity", "key"] });
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/SecretHotel|secret|35\.664|139\.859|example|private/);
    } finally { log.mockRestore(); }
  });
  it.each([
    ["You must enable Billing on the Google Cloud Project", "BILLING"],
    ["API key expired. Please renew the API key.", "API_KEY_INVALID"],
    ["Your API key was reported as leaked. Please use another API key.", "API_KEY_REVOKED"],
    ["Places API has not been used in project secret before or it is disabled.", "API_DISABLED"],
    ["Requests from this IP address secret are blocked.", "API_KEY_RESTRICTION"],
  ])("classifies configuration failures without retaining the provider message", async (message, configuration) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const fetchImpl = vi.fn().mockResolvedValue(Response.json({ error: { status: "PERMISSION_DENIED", message } }, { status: 403 }));
      await expect(createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "cafe", language: "ko" })).rejects.toThrow();
      expect(log.mock.calls[0][1]).toMatchObject({ configuration });
      expect(JSON.stringify(log.mock.calls)).not.toContain(message);
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    } finally { log.mockRestore(); }
  });
  it("requests one strict category and removes closed, duplicate and unrelated places", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [cafe, cafe, { ...cafe, id: "ChIJ1111111111", types: ["restaurant"], primaryType: "restaurant" }, { ...cafe, id: "ChIJ2222222222", businessStatus: "CLOSED_PERMANENTLY" }] }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Seoul", category: "cafe", language: "ko" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ placeId: cafe.id, name: "Real café", rating: 4.4, reviews: 27 });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({ includedType: "cafe", strictTypeFiltering: true, pageSize: 20 });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("searches around the stay by popularity when a nearby point is given", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [cafe] }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "cafe", language: "ko", near: { latitude: 35.689487, longitude: 139.691711 } });
    expect(result).toHaveLength(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://places.googleapis.com/v1/places:searchNearby");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      includedTypes: ["cafe"], includedPrimaryTypes: ["cafe", "coffee_shop", "coffee_roastery", "coffee_stand", "tea_house", "cat_cafe", "dog_cafe"], maxResultCount: 20, rankPreference: "POPULARITY", languageCode: "ko",
      locationRestriction: { circle: { center: { latitude: 35.689, longitude: 139.692 }, radius: 1500 } },
    });
  });
  it("asks Google to leave fast-food chains out of cafés near the stay", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [fastFood, coffeeShop] }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "cafe", language: "ko", near: { latitude: 35.664, longitude: 139.859 } });
    const { includedPrimaryTypes } = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(includedPrimaryTypes).toContain("cafe");
    expect(includedPrimaryTypes).not.toContain("fast_food_restaurant");
    expect(result.map(place => place.name)).toEqual(["Coffee shop"]);
  });
  it("shows only café kinds near the stay even if Google returns other main types", async () => {
    // Google은 일반 대표 유형을 요청하면 더 세부적인 대표 유형도 돌려줄 수 있다고 한다. 보여 줄 목록은 서버가 다시 정한다.
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [...notCafes, coffeeShop, ...cafeKinds, cafe] }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "cafe", language: "ko", near: { latitude: 35.664, longitude: 139.859 } });
    expect(result.map(place => place.name)).toEqual(cafeNames);
  });
  it("shows only café kinds when searching cafés by destination", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [...notCafes, coffeeShop, ...cafeKinds, cafe] }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "cafe", language: "ko" });
    // Text Search에는 대표 유형 조건이 없다. 없는 필드를 보내면 요청이 거절될 수 있어 요청은 그대로 둔다.
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ textQuery: "Tokyo cafe", includedType: "cafe", strictTypeFiltering: true, languageCode: "ko", pageSize: 20 });
    expect(result.map(place => place.name)).toEqual(cafeNames);
  });
  it("drops places whose main type is fast food from cafés found by destination", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [fastFood, burger, coffeeShop, cafeWithBurgers, cafe] }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "cafe", language: "ko" });
    expect(fetchImpl.mock.calls[0][1].headers["X-Goog-FieldMask"].split(",")).toContain("places.primaryType");
    expect(result.map(place => place.name)).toEqual(["Coffee shop", "Café serving burgers", "Real café"]);
  });
  it("keeps fast food in the food category on both searches", async () => {
    for (const near of [undefined, { latitude: 35.664, longitude: 139.859 }]) {
      const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [fastFood] }));
      const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "food", language: "ko", near });
      expect(result.map(place => place.name)).toEqual(["McDonald's"]);
      expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).not.toHaveProperty("excludedPrimaryTypes");
      expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).not.toHaveProperty("includedPrimaryTypes");
    }
  });
  it("shows up to ten places", async () => {
    const places = Array.from({ length: 12 }, (_, i) => ({ ...cafe, id: `ChIJplace${String(i).padStart(2, "0")}` }));
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Tokyo", category: "cafe", language: "ko" });
    expect(result).toHaveLength(10);
  });
  it("keeps results if a photo cannot be resolved", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({ places: [{ ...cafe, photos: [{ name: "places/ChIJ0000000000/photos/photo1", authorAttributions: [{ displayName: "Photographer" }] }] }] })).mockRejectedValueOnce(new Error("offline"));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Seoul", category: "cafe", language: "en" });
    expect(result).toHaveLength(1);
    expect(result[0].photo).toBeUndefined();
  });
  it("rejects a malformed Google payload instead of pretending there are no results", async () => {
    await expect(createPlaceBrowser({ apiKey: "secret", fetch: vi.fn().mockResolvedValue(Response.json({ places: "broken" })) })({ destination: "Seoul", category: "cafe", language: "en" })).rejects.toThrow();
  });
  it("returns photo attribution and only temporary Google image URLs", async () => {
    const photo = { name: "places/ChIJ0000000000/photos/photo1", authorAttributions: [{ displayName: "Photographer" }] };
    for (const uri of ["https://lh3.googleusercontent.com/photo", "https://evil.test/photo", "https://lh3.googleusercontent.com/photo?key=secret"]) {
      const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({ places: [{ ...cafe, photos: [photo] }] })).mockResolvedValueOnce(Response.json({ photoUri: uri }));
      const [result] = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Seoul", category: "cafe", language: "ko" });
      expect(result.photo).toEqual(uri.endsWith("/photo") && uri.includes("googleusercontent.com") ? { uri, authors: ["Photographer"] } : undefined);
      expect(fetchImpl.mock.calls[1][0]).not.toContain("secret");
    }
  });
});

describe("recommendation candidates (picks)", () => {
  const near = { latitude: 34.6687, longitude: 135.5013 };
  const spot = (id: string, extra: Record<string, unknown> = {}) => ({ id: `ChIJpick${id.padStart(6, "0")}`, displayName: { text: `Spot ${id}` }, formattedAddress: "1-1 Sample", location: { latitude: 34.67, longitude: 135.5 }, types: ["restaurant"], primaryType: "ramen_restaurant", primaryTypeDisplayName: { text: "Ramen" }, rating: 4.3, userRatingCount: 120, ...extra });
  it("runs two nearby searches without photos and returns location, hours and price", async () => {
    const hours = { periods: [{ open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 15, minute: 0 } }] };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ places: [spot("1", { regularOpeningHours: hours, priceLevel: "PRICE_LEVEL_MODERATE" }), spot("2", { businessStatus: "CLOSED_TEMPORARILY" })] }))
      .mockResolvedValueOnce(Response.json({ places: [spot("1"), spot("3", { types: ["museum"], primaryType: "museum", location: undefined }), spot("4", { types: ["museum"], primaryType: "museum" })] }));
    const result = await createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Sample City", category: "picks", language: "en", near });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
      expect(init.headers["X-Goog-FieldMask"]).not.toContain("photos");
      expect(init.headers["X-Goog-FieldMask"]).toContain("places.regularOpeningHours");
      expect(JSON.parse(init.body)).toMatchObject({ maxResultCount: 20, locationRestriction: { circle: { center: { latitude: 34.669, longitude: 135.501 }, radius: 2500 } } });
    }
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).includedTypes).toContain("restaurant");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).includedTypes).toContain("museum");
    expect(result.map(place => place.placeId)).toEqual(["ChIJpick000001", "ChIJpick000004"]);
    expect(result[0]).toMatchObject({ location: { latitude: 34.67, longitude: 135.5 }, primaryType: "ramen_restaurant", priceLevel: 2, hours: [{ open: 1 * 1440 + 660, close: 1 * 1440 + 900 }] });
    expect(result[0].photo).toBeUndefined();
  });
  it("refuses picks without a nearby point", async () => {
    const fetchImpl = vi.fn();
    await expect(createPlaceBrowser({ apiKey: "secret", fetch: fetchImpl })({ destination: "Sample City", category: "picks", language: "en" })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("reads 24-hour, overnight and malformed opening hours", () => {
    expect(weeklyHours({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] })).toEqual([{ open: 0, close: 10080 }]);
    expect(weeklyHours({ periods: [{ open: { day: 6, hour: 22, minute: 0 }, close: { day: 0, hour: 2, minute: 0 } }] })).toEqual([{ open: 6 * 1440 + 1320, close: 120 }]);
    expect(weeklyHours({ periods: [{ open: { day: 9, hour: 1 }, close: { day: 1, hour: 2 } }] })).toBeUndefined();
    expect(weeklyHours(undefined)).toBeUndefined();
  });
});
