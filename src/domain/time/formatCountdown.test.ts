import { describe, expect, it } from "vitest";
import { formatCountdown } from "./formatCountdown";

describe("formatCountdown", () => {
  it("남은 시간을 분과 초로 표시한다", () => {
    expect(
      formatCountdown(
        "2026-07-20T15:38:00+09:00",
        new Date("2026-07-20T15:33:01+09:00"),
      ),
    ).toBe("04:59");
  });

  it("목표 시각이 지났으면 00:00으로 고정한다", () => {
    expect(
      formatCountdown(
        "2026-07-20T15:30:00+09:00",
        new Date("2026-07-20T15:33:01+09:00"),
      ),
    ).toBe("00:00");
  });

  it("출발까지 하루 이상 남으면 일과 시간으로 표시한다", () => {
    expect(
      formatCountdown(
        "2026-07-20T10:00:00+09:00",
        new Date("2026-07-17T02:00:00+09:00"),
      ),
    ).toBe("3일 8시간");
  });

  it("출발까지 한 시간 이상 남으면 시간과 분으로 표시한다", () => {
    expect(
      formatCountdown(
        "2026-07-20T10:15:00+09:00",
        new Date("2026-07-20T08:00:00+09:00"),
      ),
    ).toBe("2시간 15분");
  });
});
