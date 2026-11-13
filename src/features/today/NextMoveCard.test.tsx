import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tripSeed } from "../../data/tripSeed";
import { NextMoveCard } from "./NextMoveCard";

describe("NextMoveCard", () => {
  it("여행 전 항공편을 출발·도착 시간표와 지도 행동으로 표시한다", () => {
    const activity = tripSeed.activities[0]!;
    render(
      <NextMoveCard
        activity={activity}
        now={new Date("2026-07-17T03:00:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("다음 이동")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "청주국제공항 → 간사이국제공항 T1",
      }),
    ).toBeVisible();
    expect(screen.getByText("출발")).toBeVisible();
    expect(screen.getByText("도착")).toBeVisible();
    expect(screen.getByText("10:55")).toBeVisible();
    expect(screen.getByText("12:40")).toBeVisible();
    expect(screen.getByText("3일 7시간 남음")).toBeVisible();
    expect(screen.getByText("PLAN")).toBeVisible();
    expect(screen.queryByText("ON TIME")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "도착 후 교통편 보기" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Google 지도에서 길 보기" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://www.google.com/maps/dir/?api=1"),
    );
    expect(screen.queryByText("MAIN QUEST")).not.toBeInTheDocument();
    expect(screen.queryByText("NEXT TRAIN")).not.toBeInTheDocument();
  });

  it("앱 안에서 경로를 조회하지 않고 계획 경로와 Google 지도 길찾기를 보여 준다", () => {
    const activity = tripSeed.activities.find(
      (candidate) => candidate.id === "bentencho-to-umeda",
    );
    if (activity === undefined) throw new Error("missing activity");

    render(
      <NextMoveCard
        activity={activity}
        now={new Date("2026-07-20T15:33:01+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("PLAN")).toBeVisible();
    expect(screen.getByText("계획 기준")).toBeVisible();
    expect(screen.getByRole("button", { name: "교통편 보기" })).toBeVisible();
    const url = new URL(
      screen
        .getByRole("link", { name: "Google 지도에서 길 보기" })
        .getAttribute("href") ?? "",
    );
    expect(url.searchParams.get("travelmode")).toBe("transit");
    expect(url.searchParams.get("destination")).toBe(
      `${activity.destination.latitude},${activity.destination.longitude}`,
    );
  });

  it("이륙 뒤 도착 전에는 지금 출발 대신 비행 진행 상태를 표시한다", () => {
    const activity = tripSeed.activities[0]!;
    render(
      <NextMoveCard
        activity={activity}
        now={new Date("2026-07-20T11:30:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("비행 중")).toBeVisible();
    expect(screen.getByText("12:40 도착 예정")).toBeVisible();
    expect(screen.getByText("도착까지 1시간 10분")).toBeVisible();
    expect(screen.queryByText("지금 출발")).not.toBeInTheDocument();
  });

  it("계획 출발시각이 지났지만 도착 목표 전이면 지금 출발로 안내한다", () => {
    const activity = tripSeed.activities.find(
      (candidate) => candidate.id === "bentencho-to-umeda",
    );
    if (activity === undefined) throw new Error("missing activity");

    render(
      <NextMoveCard
        activity={activity}
        now={new Date("2026-07-20T15:44:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("지금 출발")).toBeVisible();
    expect(screen.queryByText("00:00 남음")).not.toBeInTheDocument();
  });
});
