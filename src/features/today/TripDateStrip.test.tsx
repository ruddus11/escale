import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TripDateStrip } from "./TripDateStrip";

describe("TripDateStrip", () => {
  it("서머타임 종료일에도 현지 달력 날짜가 중복되지 않는다", () => {
    render(<TripDateStrip startAt="2026-11-01T00:00:00-04:00" dayCount={3}
      now={new Date("2026-11-02T08:00:00Z")} timeZone="America/New_York" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    for (const day of ["1", "2", "3"]) expect(screen.getByText(day)).toBeVisible();
    expect(screen.getByText("2").closest("li")).toHaveAttribute("aria-current", "date");
  });
  it("여행 전에는 7월 20일부터 24일까지 표시하고 첫날을 선택한다", () => {
    render(
      <TripDateStrip
        startAt="2026-07-20T12:40:00+09:00"
        dayCount={5}
        now={new Date("2026-07-17T03:00:00+09:00")}
        timeZone="Asia/Tokyo"
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "여행 날짜" });
    expect(within(navigation).getAllByRole("listitem")).toHaveLength(5);
    expect(within(navigation).getByText("20").closest("li")).toHaveAttribute(
      "aria-current",
      "date",
    );
    for (const date of ["20", "21", "22", "23", "24"]) {
      expect(within(navigation).getByText(date)).toBeVisible();
    }
  });

  it("여행 중에는 도쿄 날짜에 해당하는 일차를 선택한다", () => {
    render(
      <TripDateStrip
        startAt="2026-07-20T12:40:00+09:00"
        dayCount={5}
        now={new Date("2026-07-22T09:00:00+09:00")}
        timeZone="Asia/Tokyo"
      />,
    );

    expect(screen.getByText("22").closest("li")).toHaveAttribute(
      "aria-current",
      "date",
    );
  });
});
