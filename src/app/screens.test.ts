import { describe, expect, it } from "vitest";
import { isAppScreen, screenForTab, screenFromHash, tabForScreen } from "./screens";

describe("screens", () => {
  it("수첩 화면만 주소로 받는다", () => {
    expect(isAppScreen("places")).toBe(true);
    expect(isAppScreen("settings")).toBe(false);
  });

  it("모르는 주소는 오늘로, 예전 정보 주소는 예약으로 연다", () => {
    expect(screenFromHash("#schedule")).toBe("schedule");
    expect(screenFromHash("#info")).toBe("bookings");
    expect(screenFromHash("#unknown")).toBe("today");
  });

  it("오늘·전체 일정·교통편은 일정 탭에 속하고, 표지는 탭 밖이다", () => {
    expect(tabForScreen("transit")).toBe("plan");
    expect(tabForScreen("budget")).toBe("budget");
    expect(tabForScreen("covers")).toBeNull();
    expect(screenForTab("plan")).toBe("today");
  });
});
