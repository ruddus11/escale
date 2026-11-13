import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { tripSeed } from "../../data/tripSeed";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import { TodayScreen } from "./TodayScreen";

const now = new Date("2026-07-20T15:33:01+09:00");

describe("TodayScreen", () => {
  it("여행 시작 전에는 출발 전 상태를 표시한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        now={new Date("2026-07-17T02:00:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("DAY 1")).toBeVisible();
    expect(screen.getByText("출발 준비 완료")).toBeVisible();
    expect(screen.getByText("출발 전")).toBeVisible();
    expect(screen.getByText("3일 8시간 남음")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "도착 후 교통편 보기" }),
    ).toBeVisible();
  });

  it("출발 당일에도 공항으로 떠나기 전까지 출발 전 상태를 유지한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-20T06:00:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("출발 준비 완료")).toBeVisible();
    expect(screen.getByText("출발 전")).toBeVisible();
    expect(screen.queryByText("여행 진행 중")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "청주공항 도착·국제선 수속" }),
    ).toBeVisible();
    expect(screen.getByText("09:00")).toBeVisible();
  });

  it("체크인 마감 시각에는 경고 앵커와 곧 출발할 항공편을 함께 표시한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-20T10:10:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("진행 중 · 고정")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "국제선 체크인 마감" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "청주국제공항 → 간사이국제공항 T1",
      }),
    ).toBeVisible();
  });

  it("귀국편 출발 직전에는 탑승구 대기 앵커를 숨기지 않는다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-24T13:15:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("진행 중 · 고정")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "탑승구 대기 완료" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "TW328 KIX T1 출발 → 청주" }),
    ).toBeVisible();
  });

  it("여행 시작 전에는 해외 목적지가 아니라 청주공항 지도를 먼저 연다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-17T02:00:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByRole("link", { name: "Google Maps" })).toHaveAttribute(
      "href",
      expect.stringContaining("%EC%B2%AD%EC%A3%BC%EA%B5%AD%EC%A0%9C%EA%B3%B5%ED%95%AD"),
    );
  });

  it("Day 3 다음 일정 지도는 모호한 표시명 대신 검증된 매장 주소를 연다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-22T10:55:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    const url = new URL(
      screen.getByRole("link", { name: "Google Maps" }).getAttribute("href") ??
        "",
    );
    expect(url.searchParams.get("query")).toContain("BAPE STORE OSAKA");
    expect(url.searchParams.get("query")).toContain("南堀江1-19-2");
  });

  it("공항에서 이동 중에는 다음 체크인보다 현재 벤텐초 경로를 유지한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-20T14:30:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("현재 이동")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "KIX → 벤텐초" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Google 지도에서 길 보기" })).toHaveAttribute(
      "href",
      expect.stringContaining("destination=34.6694%2C135.4621"),
    );
  });

  it("승인된 밝은 시간표 정보 위계를 표시한다", () => {
    render(<TodayScreen plan={tripSeed} now={now} onOpenTransit={() => {}} />);

    expect(screen.getByText("DAY 1")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "여행 날짜" })).toBeVisible();
    expect(screen.getByText("현재 일정")).toBeVisible();
    expect(screen.getByText("여행 진행 중")).toBeVisible();
    expect(screen.getByText("다음 일정의 시각과 이동 경로를 확인하세요.")).toBeVisible();
    expect(screen.queryByText("정상")).not.toBeInTheDocument();
    expect(screen.getByText("도착 목표 우선")).toBeVisible();
    expect(screen.getByText("우메다 스카이 전망대")).toBeVisible();
    expect(screen.queryByText("MAIN QUEST")).not.toBeInTheDocument();
    expect(screen.queryByText("NEXT TRAIN")).not.toBeInTheDocument();
    expect(screen.queryByText("QUEST TARGET")).not.toBeInTheDocument();
    expect(screen.queryByText("NEXT STAGES")).not.toBeInTheDocument();
  });

  it("주요 행동으로 교통편 화면 진입을 요청한다", async () => {
    const user = userEvent.setup();
    const onOpenTransit = vi.fn();
    render(
      <TodayScreen plan={tripSeed} now={now} onOpenTransit={onOpenTransit} />,
    );

    await user.click(screen.getByRole("button", { name: "교통편 보기" }));

    expect(onOpenTransit).toHaveBeenCalledOnce();
  });

  it("시각을 수정한 이동은 계획 시각 대신 재확인 경고를 보여 준다", () => {
    const schedulePlan = structuredClone(osakaWorkspaceSeed.schedule);
    const next = schedulePlan.activities.find(
      (activity) => activity.routeActivityId === "bentencho-to-umeda",
    );
    if (next === undefined) throw new Error("missing schedule activity");
    next.routeTimingStale = true;

    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={schedulePlan}
        now={now}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("일정 변경 · 교통편 재확인 필요")).toBeVisible();
    expect(screen.queryByText(/현재 조회 기준/)).not.toBeInTheDocument();
  });

  it("Day 4 요이야마 진행 중에는 축제를 유지하고 다음 복귀 일정을 따로 안내한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-23T18:16:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("진행 중 · 고정")).toBeVisible();
    const currentHeading = screen.getByRole("heading", {
      name: "기온마츠리 아토마츠리 요이야마",
    });
    const returnHeading = screen.getByRole("heading", {
      name: "교토에서 호텔 이동",
    });
    expect(currentHeading).toBeVisible();
    expect(screen.getByText("20:45 종료 예정")).toBeVisible();
    expect(returnHeading).toBeVisible();
    expect(currentHeading.id).not.toBe(returnHeading.id);
  });

  it("고정 앵커 시작 전에는 예정 상태를 명확히 표시한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-23T18:05:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("예정 · 고정")).toBeVisible();
    expect(screen.getByRole("heading", { name: "기온마츠리 아토마츠리 요이야마" })).toBeVisible();
    expect(screen.getByText("10:00 남음")).toBeVisible();
  });

  it("Day 5 귀국편이 진행 중이면 마지막 일정 종료 전까지 여행 진행 상태를 유지한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-24T14:00:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(screen.getByText("여행 진행 중")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "TW328 KIX T1 출발 → 청주" }),
    ).toBeVisible();
    expect(screen.getByText("15:20 종료 예정")).toBeVisible();
    expect(screen.queryByText("오늘 일정 완료")).not.toBeInTheDocument();
  });

  it("전망대 관람 뒤에는 현재 위치에서 호텔로 돌아가는 경로를 유지한다", () => {
    render(
      <TodayScreen
        plan={tripSeed}
        schedulePlan={osakaWorkspaceSeed.schedule}
        now={new Date("2026-07-20T20:15:00+09:00")}
        onOpenTransit={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "우메다 스카이에서 호텔 이동" }),
    ).toBeVisible();
    const mapUrl = new URL(
      screen.getByRole("link", { name: "Google Maps" }).getAttribute("href") ??
        "",
    );
    expect(mapUrl.searchParams.has("origin")).toBe(false);
    expect(mapUrl.searchParams.get("destination")).toContain("アートホテル");
    expect(mapUrl.searchParams.get("travelmode")).toBe("transit");
  });
});
