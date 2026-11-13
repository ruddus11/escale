import { describe, expect, it } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("기기 시간대와 무관하게 UTC 응답을 일본 현지시각으로 표시한다", () => {
    expect(formatTime("2026-07-20T07:47:00Z")).toBe("16:47");
  });

  it("Date 입력도 기기 현지 시각으로 표시한다", () => {
    expect(formatTime(new Date("2026-07-20T15:05:00Z"))).toBe("00:05");
  });
});
