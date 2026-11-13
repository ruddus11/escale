import { describe, expect, it } from "vitest";
import { parseStayPhoto, duplicateStay } from "../src/data/stayPhoto";

describe("stay photo drafts", () => {
  it("reads only labeled hotel facts, leaving private lines out", () => {
    expect(parseStayPhoto(["호텔명: 바다 호텔", "예약 번호: SECRET123", "체크인", "2026-10-24", "체크아웃: 2026-10-27", "guest: Jane"])).toEqual({ title: "바다 호텔", startDate: "2026-10-24", endDate: "2026-10-27" });
  });
  it("does not infer a year or ambiguous day/month order", () => {
    expect(parseStayPhoto(["Check-in: 10/11/2026", "Check-out: Oct 12", "Reservation date: 2026-09-01"])).toEqual({ title: "", startDate: "", endDate: "" });
  });
  it("rejects invalid dates and reversed stays", () => {
    expect(parseStayPhoto(["Check-in: 2026-02-30"]).startDate).toBe("");
    expect(parseStayPhoto(["Check-in: 2026-10-27", "Check-out: 2026-10-24"]).startDate).toBe("");
  });
  it("does not choose between multiple bookings", () => {
    expect(parseStayPhoto(["Hotel: First", "Check-in: 2026-10-01", "Hotel: Second", "Check-in: 2026-11-01"])).toEqual({ title: "", startDate: "", endDate: "" });
  });
  it("does not use a checkout date as checkin", () => {
    expect(parseStayPhoto(["Check-in", "Check-out", "2026-10-27"]).startDate).toBe("");
  });
  it("reads Korean date suffixes without assuming a year", () => {
    expect(parseStayPhoto(["바다 호텔", "체크인 2026년 10월 24일", "체크아웃 2026년 10월 27일"])).toEqual({ title: "바다 호텔", startDate: "2026-10-24", endDate: "2026-10-27" });
  });
  it("reads named English months with explicit years", () => {
    expect(parseStayPhoto(["Hotel: Sea House", "Check-in: October 24, 2026", "Check-out: 27 October 2026"])).toEqual({ title: "Sea House", startDate: "2026-10-24", endDate: "2026-10-27" });
  });
  it("identifies the same stay without depending on whitespace", () => {
    expect(duplicateStay({ title: "Sea Hotel", startDate: "2026-10-24", endDate: "2026-10-27" }, [{ id: "1", kind: "stay", title: "Sea  Hotel", startDate: "2026-10-24", endDate: "2026-10-27", timeZone: "Asia/Seoul", updatedAt: "" }])).toBe(true);
  });
  it("leaves conflicting dates on one label blank", () => {
    expect(parseStayPhoto(["Check-in: 2026-10-24 / 2026-10-25"]).startDate).toBe("");
    expect(parseStayPhoto(["Check-in", "2026-10-24", "2026-10-25"]).startDate).toBe("");
  });
  it("does not accept a word that merely starts with a month name", () => {
    expect(parseStayPhoto(["Check-in: Octoberxx 24, 2026"]).startDate).toBe("");
  });
});
