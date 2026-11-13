import { describe, expect, it } from "vitest";
import type { Reservation } from "../../src/domain/reservations/types";
import { nextAirportArrival } from "../src/data/airportTime";
import { airportAnswer } from "../src/data/pouchAnswers";

const out: Reservation = { id: "rf318", kind: "flight", title: "RF318 · CJJ → KIX", serviceNumber: "RF318", departure: "CJJ", arrival: "KIX", startDate: "2026-12-21", startTime: "16:40", timeZone: "Asia/Seoul", endDate: "2026-12-21", endTime: "18:30", endTimeZone: "Asia/Tokyo", updatedAt: "" };
const back: Reservation = { ...out, id: "rf305", title: "RF305 · KIX → CJJ", serviceNumber: "RF305", departure: "KIX", arrival: "CJJ", startDate: "2026-12-24", startTime: "20:20", timeZone: "Asia/Tokyo", endDate: "2026-12-24", endTime: "22:10", endTimeZone: "Asia/Seoul" };

describe("airport answer", () => {
  it("uses the outgoing flight's local departure and airport arrival", () => {
    const answer = airportAnswer(nextAirportArrival([out, back], new Date("2026-12-01T00:00:00Z")), "ko");
    expect(answer).toContain("12월 21일 RF318 · 16:40 출발이에요(서울 시각)");
    expect(answer).toContain("14:40까지 청주공항");
  });

  it("switches to the return flight after the outgoing flight departs", () => {
    const answer = airportAnswer(nextAirportArrival([out, back], new Date("2026-12-21T07:41:00Z")), "ko");
    expect(answer).toContain("12월 24일 RF305 · 20:20 출발이에요(도쿄 시각)");
    expect(answer).toContain("18:20까지 간사이공항");
  });

  it("points to the real booking section when there is no upcoming flight", () => {
    expect(airportAnswer(undefined, "ko")).toContain("여행 도구 › 항공·숙소에서 항공편을 추가해 주세요");
  });

  it("does not make up a departure or arrival time", () => {
    const answer = airportAnswer(nextAirportArrival([{ ...out, startTime: undefined }], new Date("2026-12-01T00:00:00Z")), "ko");
    expect(answer).toContain("12월 21일 RF318");
    expect(answer).toContain("출발 시각은 아직 저장되지 않았어요");
    expect(answer).not.toContain("14:40");
  });

  it("includes the previous date for an early domestic flight", () => {
    const early = { ...out, departure: "GMP", arrival: "CJU", endTimeZone: "Asia/Seoul", startTime: "00:30" };
    const answer = airportAnswer(nextAirportArrival([early], new Date("2026-12-01T00:00:00Z")), "ko");
    expect(answer).toContain("국내선이라 출발 1시간 전인 12월 20일 23:30까지 김포공항");
  });

  it("localizes English and Japanese answers", () => {
    const arrival = nextAirportArrival([out], new Date("2026-12-01T00:00:00Z"));
    expect(airportAnswer(arrival, "en-US")).toContain("CJJ airport by 14:40");
    expect(airportAnswer(arrival, "ja")).toContain("CJJ空港");
  });
});
