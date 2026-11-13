import { describe, expect, it } from "vitest";
import { dateForTimeText, formatTimeText, parseTimeText, stepTimeText, timeTextOfDate } from "../src/data/timeText";

describe("reservation time text", () => {
  it("저장 형식 HH:MM만 읽는다", () => {
    expect(parseTimeText("09:05")).toEqual({ hour: 9, minute: 5 });
    expect(parseTimeText("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeText("00:00")).toEqual({ hour: 0, minute: 0 });
    for (const bad of ["", undefined, "9:05", "24:00", "12:60", "12:5", " 12:00", "12:00:00"]) expect(parseTimeText(bad)).toBeUndefined();
  });

  it("두 자리로 채워 쓴다", () => {
    expect(formatTimeText({ hour: 7, minute: 3 })).toBe("07:03");
  });

  it("기존 값은 선택기를 거쳐도 그대로 돌아온다", () => {
    for (let hour = 0; hour < 24; hour++)
      for (const minute of [0, 1, 7, 30, 59]) {
        const text = formatTimeText({ hour, minute });
        expect(timeTextOfDate(dateForTimeText(text, new Date(2026, 9, 25, 15, 41)))).toBe(text);
      }
  });

  it("빈 값과 틀린 값은 정오에서 열고 날짜는 기준 날짜를 둔다", () => {
    const base = new Date(2026, 9, 25, 8, 30);
    for (const text of [undefined, "", "9:05"]) {
      const date = dateForTimeText(text, base);
      expect(timeTextOfDate(date)).toBe("12:00");
      expect(date.getDate()).toBe(25);
    }
    expect(base.getHours()).toBe(8);
  });

  it("웹 선택기는 시 1시간, 분 1분·10분씩 돌아 0–59분을 모두 고른다", () => {
    expect(stepTimeText("23:15", "hour", 1)).toBe("00:15");
    expect(stepTimeText("00:15", "hour", -1)).toBe("23:15");
    expect(stepTimeText("09:06", "minute", 1)).toBe("09:07");
    expect(stepTimeText("09:07", "minute", -1)).toBe("09:06");
    expect(stepTimeText("09:59", "minute", 1)).toBe("09:00");
    expect(stepTimeText("09:00", "minute", -1)).toBe("09:59");
    expect(stepTimeText("09:07", "minute", 10)).toBe("09:17");
    expect(stepTimeText("09:55", "minute", 10)).toBe("09:05");
    expect(stepTimeText("09:07", "minute", -10)).toBe("09:57");
    expect(stepTimeText(undefined, "hour", 1)).toBe("13:00");
    const seen = new Set<string>();
    let text = "09:00";
    for (let i = 0; i < 60; i++) {
      seen.add(text);
      text = stepTimeText(text, "minute", 1);
    }
    expect(seen.size).toBe(60);
    expect(text).toBe("09:00");
  });
});
