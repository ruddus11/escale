import { describe, expect, it } from "vitest";
import { requestExtraction } from "../src/data/confirmationImport";
import { findPlace, suggestPlaces } from "../src/data/places";
import { requestPouchJudgment } from "../src/data/pouchJudge";
import { isLimitKey, limitKey } from "../src/data/usageLimit";
import { translate } from "../src/i18n/strings";

function tooMany(code: unknown) {
  return new Response(JSON.stringify({ code, retryAfter: 30, message: "x" }), { status: 429, headers: { "Retry-After": "30" } });
}

function limited(code: unknown) {
  return (async () => tooMany(code)) as unknown as typeof fetch;
}

describe("server usage limits", () => {
  it("picks a short message from the 429 code", async () => {
    expect(await limitKey(tooMany("RATE_LIMITED"))).toBe("limit.rate");
    expect(await limitKey(tooMany("DAILY_LIMIT_REACHED"))).toBe("limit.daily");
    expect(await limitKey(tooMany("SERVICE_LIMIT_REACHED"))).toBe("limit.service");
    expect(await limitKey(new Response("not json", { status: 429 }))).toBe("limit.rate");
    expect(isLimitKey("limit.daily")).toBe(true);
    expect(isLimitKey("place.failed")).toBe(false);
  });

  it("has the message in Korean, English and Japanese", () => {
    expect(translate("ko", "limit.rate")).toContain("잠시 후");
    expect(translate("en-US", "limit.daily")).toContain("today's limit");
    expect(translate("ja", "limit.service")).toContain("後で");
  });

  it("shows the limit message in place search, Jev reading and import", async () => {
    const place = { baseUrl: "https://pouch.example", credential: "token", lang: "en-US" as const };
    await expect(suggestPlaces({ ...place, text: "lisbon", sessionToken: "0f8fad5b-d9cb-469f-a165-70867728950e", fetchImpl: limited("RATE_LIMITED") })).rejects.toMatchObject({ key: "limit.rate" });
    await expect(findPlace({ ...place, text: "Porto", fetchImpl: limited("DAILY_LIMIT_REACHED") })).rejects.toMatchObject({ key: "limit.daily" });
    await expect(requestPouchJudgment({ baseUrl: "https://pouch.example", accessCode: "c", text: "packed charger", items: [], fetchImpl: limited("RATE_LIMITED") })).rejects.toMatchObject({ key: "limit.rate" });
    await expect(requestExtraction({ baseUrl: "https://pouch.example", accessCode: "c", text: "Flight 2026-11-01 10:00", year: 2026, fetchImpl: limited("DAILY_LIMIT_REACHED") })).rejects.toMatchObject({ key: "limit.daily" });
  });
});
