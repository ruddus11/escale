import { describe, expect, it } from "vitest";
import type { Reservation } from "../../src/domain/reservations/types";
import { fillReservation, filledCount, requestExtraction, sanitize } from "../src/data/confirmationImport";

const form: Reservation = { id: "r", kind: "stay", title: "", startDate: "2026-11-01", timeZone: "Asia/Seoul", updatedAt: "2026-10-12T00:00:00.000Z" };

describe("requestExtraction", () => {
  it("hides booking numbers on the device before sending", async () => {
    let sent = "";
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string).text;
      return { ok: true, status: 200, json: async () => ({ reservation: { kind: "flight", startDate: "2026-11-03" } }) } as Response;
    }) as unknown as typeof fetch;
    const result = await requestExtraction({ baseUrl: "https://pouch.example", accessCode: "code", text: "예약번호: A1B2C3 / 010-1234-5678 / KE 123", year: 2026, fetchImpl });
    expect(sent).not.toContain("A1B2C3");
    expect(sent).not.toContain("010-1234-5678");
    expect(sent).toContain("KE 123");
    expect(result).toEqual({ kind: "flight", startDate: "2026-11-03" });
  });
  it("refuses empty text without calling the server", async () => {
    await expect(requestExtraction({ baseUrl: "https://pouch.example", accessCode: "code", text: "   ", year: 2026, fetchImpl: (() => { throw new Error("called"); }) as unknown as typeof fetch })).rejects.toThrow("붙여넣어");
  });
});

describe("sanitize and fill", () => {
  it("keeps only well-formed values from the server", () => {
    expect(sanitize({ kind: "rocket", startDate: "11/03", startTime: "25:00", timeZone: "Mars/Base", departure: "인천 ICN", endTimeZone: "Asia/Tokyo" })).toEqual({ departure: "인천 ICN", endTimeZone: "Asia/Tokyo" });
  });
  it("fills the form and counts what was found", () => {
    const extracted = { kind: "flight" as const, title: "KE 123 인천 → 오사카 간사이", startDate: "2026-11-03", startTime: "09:40", endTime: "11:25", timeZone: "Asia/Seoul", endTimeZone: "Asia/Tokyo" };
    expect(fillReservation(form, extracted)).toMatchObject({ kind: "flight", startDate: "2026-11-03", endDate: "2026-11-03", endTime: "11:25", endTimeZone: "Asia/Tokyo" });
    expect(filledCount(extracted)).toBe(5);
  });
});
