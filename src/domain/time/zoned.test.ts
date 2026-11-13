import { expect, it } from "vitest";
import { fromLocal, zonedDate, zonedIso } from "./zoned";
it("여행 시간대에서 날짜와 오프셋을 계산한다", () => {
 expect(zonedDate("2026-07-01T01:00:00Z", "America/New_York")).toBe("2026-06-30");
 expect(fromLocal("2026-07-01", "10:00", "Europe/Paris")).toBe("2026-07-01T10:00:00+02:00");
 expect(fromLocal("2026-01-01", "10:00", "America/New_York")).toBe("2026-01-01T10:00:00-05:00");
 expect(zonedIso("2026-07-01T00:00:00Z", "Asia/Seoul")).toBe("2026-07-01T09:00:00+09:00");
});
it("DST 누락·중복과 잘못된 날짜를 거부한다", () => {
 expect(() => fromLocal("2026-03-08", "02:30", "America/New_York")).toThrow();
 expect(() => fromLocal("2026-11-01", "01:30", "America/New_York")).toThrow();
 expect(() => fromLocal("2026-02-30", "12:00", "UTC")).toThrow();
});
it("시간대를 바꿔도 밀리초까지 같은 순간을 유지한다", () => {
 const original = "2026-07-01T12:30:45.123Z";
 expect(Date.parse(zonedIso(original, "Europe/Paris"))).toBe(Date.parse(original));
});
