import { describe, expect, it } from "vitest";
import { isReservation, validateReservation, selectQuickReservations, reservationServiceUrl } from "./reservations";
import type { Reservation } from "./types";

const stay: Reservation = {
  id: "stay", kind: "stay", title: "동네 숙소", startDate: "2026-10-08", endDate: "2026-10-10",
  timeZone: "Asia/Seoul", startTime: "15:00", endTime: "11:00", updatedAt: "2026-10-01T00:00:00Z",
};

describe("예약 기본정보", () => {
  it("예약번호·티켓·인증 링크는 저장 스키마에서 받지 않는다", () => {
    expect(isReservation(stay)).toBe(true);
    for (const key of ["confirmationNumber", "qr", "passport", "attachment"]) {
      expect(isReservation({ ...stay, [key]: "secret" })).toBe(false);
    }
    for (const sourceUrl of ["javascript:alert(1)", "https://example.com/?token=secret", "https://example.com/bookings/secret", "https://user:pass@example.com/"]) {
      expect(isReservation({ ...stay, sourceUrl })).toBe(false);
    }
    expect(reservationServiceUrl("https://example.com")).toBe("https://example.com/");
  });
  it("실제 날짜·출도착 시간대·역전된 시각을 검사한다", () => {
    expect(validateReservation({ ...stay, startDate: "2026-02-30" })).not.toEqual([]);
    expect(validateReservation({ ...stay, endDate: "2026-10-07" })).not.toEqual([]);
    expect(validateReservation({ ...stay, startTime: "25:00" })).not.toEqual([]);
    expect(validateReservation({ ...stay, timeZone: "invalid" })).not.toEqual([]);
    // 날짜변경선을 건너 현지 도착일이 더 이르더라도 실제 도착이 뒤면 허용한다.
    const flight = { ...stay, kind: "flight" as const, startDate: "2026-10-09", startTime: "00:30", endDate: "2026-10-08", endTime: "19:30", endTimeZone: "America/Los_Angeles" };
    expect(validateReservation(flight)).toEqual([]);
    expect(validateReservation({ ...flight, endTime: "00:30" })).not.toEqual([]);
  });
  it("현재 숙소와 현지 날짜의 예약을 우선하며 체크아웃 뒤에는 숙소를 내린다", () => {
    const ticket: Reservation = { ...stay, id: "ticket", kind: "activity", title: "전시", startDate: "2026-10-09", startTime: "18:00", endDate: undefined, endTime: undefined };
    const now = new Date("2026-10-09T00:00:00Z");
    expect(selectQuickReservations([ticket, stay], now).map(r => r.id)).toEqual(["stay", "ticket"]);
    expect(selectQuickReservations([stay], new Date("2026-10-10T03:00:00Z"))).toEqual([]);
  });
  it("출발 전에는 가장 가까운 예약을 꺼내고 지난 여행은 억지로 오늘로 표시하지 않는다", () => {
    expect(selectQuickReservations([stay], new Date("2026-10-01T00:00:00Z"))).toEqual([stay]);
    expect(selectQuickReservations([stay], new Date("2026-11-01T00:00:00Z"))).toEqual([]);
  });
  it("시간 미정과 두 번 나타나는 DST 시각을 구분한다", () => {
    expect(validateReservation({ ...stay, startTime: undefined, endTime: undefined })).toEqual([]);
    expect(validateReservation({ ...stay, kind: "activity", startDate: "2026-11-01", startTime: "01:30", timeZone: "America/New_York", endDate: undefined, endTime: undefined })).not.toEqual([]);
  });
});
