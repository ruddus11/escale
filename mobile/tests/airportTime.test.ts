import { describe, expect, it } from "vitest";
import type { Reservation } from "../../src/domain/reservations/types";
import { airportArrival, airportCode, airportLabel, airportName, isInternational, nextAirportArrival, nextFlight } from "../src/data/airportTime";

const out: Reservation = { id: "rf318", kind: "flight", title: "RF318 · CJJ → KIX", serviceNumber: "RF318", departure: "CJJ", arrival: "KIX", startDate: "2026-12-21", startTime: "16:40", timeZone: "Asia/Seoul", endDate: "2026-12-21", endTime: "18:30", endTimeZone: "Asia/Tokyo", updatedAt: "" };
const back: Reservation = { id: "rf305", kind: "flight", title: "RF305 · KIX → CJJ", serviceNumber: "RF305", departure: "오사카 간사이 KIX", arrival: "청주 CJJ", startDate: "2026-12-24", startTime: "20:20", timeZone: "Asia/Tokyo", endDate: "2026-12-24", endTime: "22:10", endTimeZone: "Asia/Seoul", updatedAt: "" };
const stay: Reservation = { id: "s", kind: "stay", title: "Hotel", startDate: "2026-12-21", startTime: "15:00", timeZone: "Asia/Tokyo", updatedAt: "" };

describe("airportTime", () => {
  it("labels airports by language without leaking Korean names", () => {
    expect(airportLabel("KIX", "ko")).toBe("간사이공항");
    expect(airportLabel("KIX", "en-US")).toBe("KIX");
    expect(airportLabel("청주 CJJ", "en-GB")).toBe("CJJ");
    expect(airportLabel("인천(ICN)", "ja")).toBe("ICN");
    expect(airportLabel(" Oslo ", "en-US")).toBe("Oslo");
    expect(airportLabel(undefined, "en-US")).toBeUndefined();
  });
  it("reads codes and names", () => {
    expect(airportCode("청주 CJJ")).toBe("CJJ");
    expect(airportCode("인천(ICN)")).toBe("ICN");
    expect(airportCode("XYZ")).toBeUndefined();
    expect(airportName("CJJ")).toBe("청주공항");
    expect(airportName("KIX")).toBe("간사이공항");
    expect(airportName("NRT")).toBe("나리타공항");
    expect(airportName("HND")).toBe("하네다공항");
    expect(airportName("ICN")).toBe("인천공항");
    expect(airportName("GMP")).toBe("김포공항");
  });
  it("2h before international, 1h domestic", () => {
    expect(isInternational(out)).toBe(true);
    expect(airportArrival(out)).toMatchObject({ airport: "청주공항", leadMinutes: 120, arriveDate: "2026-12-21", arriveTime: "14:40", timeZone: "Asia/Seoul" });
    const jeju: Reservation = { ...out, departure: "GMP", arrival: "CJU", endTimeZone: "Asia/Seoul", startTime: "00:30" };
    expect(airportArrival(jeju)).toMatchObject({ international: false, leadMinutes: 60, arriveDate: "2026-12-20", arriveTime: "23:30" });
  });
  it("picks the next flight, then the return flight", () => {
    const list = [back, stay, out];
    expect(nextFlight(list, new Date("2026-12-01T00:00:00Z"))?.id).toBe("rf318");
    // 12/21 16:40 서울 = 07:40Z. 그 뒤엔 돌아오는 편.
    expect(nextFlight(list, new Date("2026-12-21T07:41:00Z"))?.id).toBe("rf305");
    expect(nextAirportArrival(list, new Date("2026-12-22T00:00:00Z"))).toMatchObject({ airport: "간사이공항", arriveTime: "18:20", timeZone: "Asia/Tokyo" });
    expect(nextFlight(list, new Date("2026-12-25T00:00:00Z"))).toBeUndefined();
    expect(nextAirportArrival([stay], new Date("2026-12-01T00:00:00Z"))).toBeUndefined();
  });
  it("no departure time → no arrival time", () => {
    expect(airportArrival({ ...out, startTime: undefined }).arriveTime).toBeUndefined();
  });
});
