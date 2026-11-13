import { describe, expect, it } from "vitest";
import { assembleReservation, findCandidates, redactConfirmation } from "./confirmation";

const flightMail = `[대한항공] 예약이 확정되었습니다.
예약번호: A1B2C3
승객: HONG/GILDONG  연락처 010-1234-5678  hong@example.com
가는 편 KE 123  2026년 11월 3일 (화)  인천 ICN 09:40 → 오사카 간사이 KIX 11:25
오는 편 KE 124  2026년 11월 6일 (금)  KIX 13:00 → ICN 14:55
결제 카드 4111 1111 1111 1111`;

describe("redactConfirmation", () => {
  it("hides booking numbers, contacts and card numbers but keeps trip details", () => {
    const text = redactConfirmation(flightMail);
    expect(text).not.toContain("A1B2C3");
    expect(text).not.toContain("010-1234-5678");
    expect(text).not.toContain("hong@example.com");
    expect(text).not.toContain("4111");
    expect(text).toContain("KE 123");
    expect(text).toContain("ICN 09:40");
    expect(text).toContain("2026년 11월 3일");
  });
  it("hides English booking references too", () => {
    expect(redactConfirmation("Booking reference: XYZ789 Flight OZ102")).toBe("Booking reference: [가림] Flight OZ102");
  });
});

describe("findCandidates", () => {
  it("collects dates, times, airports and flight numbers from a Korean mail", () => {
    const c = findCandidates(redactConfirmation(flightMail), 2026);
    expect(c.dates.map((d) => d.value)).toEqual(["2026-11-03", "2026-11-06"]);
    expect(c.times.map((t) => t.value)).toEqual(["09:40", "11:25", "13:00", "14:55"]);
    expect(c.places.map((p) => p.value)).toEqual(["ICN", "KIX", "KIX", "ICN"]);
    expect(c.services.map((s) => s.value)).toEqual(["KE 123", "KE 124"]);
  });
  it("reads English dates, 12-hour times, train numbers and station names", () => {
    const c = findCandidates("Departs 12 Oct 2026 3:30 PM / Oct 14 9:05 am. KTX 027 서울역 → 부산역 오후 3시 30분", 2026);
    expect(c.dates.map((d) => d.value)).toEqual(["2026-10-12", "2026-10-14"]);
    expect(c.times.map((t) => t.value)).toEqual(["15:30", "09:05", "15:30"]);
    expect(c.places.map((p) => p.value)).toEqual(["서울역", "부산역"]);
    expect(c.services.map((s) => s.value)).toEqual(["KTX 027"]);
  });
  it("uses the reference year for dates without a year and skips impossible dates", () => {
    expect(findCandidates("10월 12일 출발, 2월 30일", 2027).dates.map((d) => d.value)).toEqual(["2027-10-12"]);
  });
});

describe("assembleReservation", () => {
  it("fills city names and local time zones from airport codes", () => {
    const c = findCandidates(redactConfirmation(flightMail), 2026);
    expect(assembleReservation(c, { kind: "flight", startDate: "d1", startTime: "t1", endTime: "t2", departure: "p1", arrival: "p2", service: "s1" })).toEqual({
      kind: "flight",
      title: "KE 123 인천 → 오사카 간사이",
      startDate: "2026-11-03",
      startTime: "09:40",
      endDate: "2026-11-03",
      endTime: "11:25",
      departure: "인천 ICN",
      arrival: "오사카 간사이 KIX",
      serviceNumber: "KE 123",
      timeZone: "Asia/Seoul",
      endTimeZone: "Asia/Tokyo",
    });
  });
  it("leaves out anything that was not picked", () => {
    const c = findCandidates("서울역 → 부산역 2026-10-12", 2026);
    expect(assembleReservation(c, { startDate: "d1" })).toEqual({ startDate: "2026-10-12" });
  });
});
