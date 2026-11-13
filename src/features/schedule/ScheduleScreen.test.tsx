import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import type { ScheduleActivity, SchedulePlan } from "../../domain/schedule/types";
import { ScheduleScreen } from "./ScheduleScreen";

const place = (latitude: number, longitude: number) => ({
  placeId: `p-${latitude}`,
  displayName: "장소",
  formattedAddress: "오사카",
  location: { latitude, longitude },
  googleMapsUri: "https://maps.google.com/?cid=1",
  attachedAt: "2026-07-17T12:00:00+09:00",
});

const basePlan: SchedulePlan = {
  id: "test-plan",
  schemaVersion: 1,
  seedVersion: 1,
  title: "테스트 일정",
  startDate: "2026-07-20",
  endDate: "2026-07-24",
  timeZone: "Asia/Tokyo",
  currency: "JPY",
  travelerCount: 2,
  activities: [],
  updatedAt: "2026-07-17T00:00:00+09:00",
};

const activityWithPlaceA: ScheduleActivity = {
  id: "a-1",
  routeTimingStale: false,
  title: "우메다 쇼핑",
  targetAt: "2026-07-21T10:00:00+09:00",
  placeName: "우메다",
  kind: "shopping",
  durationMinutes: 60,
  priority: "flexible",
  timeKind: "estimate",
  place: place(34.7025, 135.496),
};

const activityWithPlaceB: ScheduleActivity = {
  ...activityWithPlaceA,
  id: "a-2",
  title: "오사카성",
  targetAt: "2026-07-21T13:00:00+09:00",
  place: place(34.6873, 135.5262),
};

function ScheduleHarness() {
  const [plan, setPlan] = useState<SchedulePlan>(() =>
    structuredClone(osakaWorkspaceSeed.schedule),
  );
  return (
    <ScheduleScreen
      plan={plan}
      now={new Date("2026-07-17T03:00:00+09:00")}
      onChange={setPlan}
      idFactory={() => "test-id"}
    />
  );
}

describe("ScheduleScreen", () => {
  it("맛집 시트를 닫으면 열었던 일정 버튼으로 초점이 돌아온다", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleScreen
        plan={{ ...basePlan, activities: [activityWithPlaceA] }}
        now={new Date("2026-07-21T00:00:00+09:00")}
        onChange={() => undefined}
      />,
    );
    const open = screen.getByRole("button", { name: "우메다 쇼핑 주변 맛집" });
    await user.click(open);
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "우메다 쇼핑 주변 맛집" })).toHaveFocus();
  });

  it("5일 날짜와 선택한 날의 전체 일정을 표시한다", () => {
    render(<ScheduleHarness />);

    expect(screen.getByRole("heading", { name: "일정표" })).toBeVisible();
    const dates = screen.getByRole("navigation", { name: "일정 날짜 선택" });
    expect(within(dates).getAllByRole("button")).toHaveLength(5);
    expect(screen.getByText("TW327 간사이국제공항 T1 도착")).toBeVisible();
    expect(screen.getByText("우메다 스카이 전망대")).toBeVisible();
  });

  it("새 일정을 등록하고 시간순 목록에 반영한다", async () => {
    const user = userEvent.setup();
    render(<ScheduleHarness />);

    await user.click(screen.getByRole("button", { name: "일정 추가" }));
    await user.type(screen.getByLabelText("일정 이름"), "편의점 들르기");
    await user.clear(screen.getByLabelText("시각"));
    await user.type(screen.getByLabelText("시각"), "19:30");
    await user.type(screen.getByLabelText("장소"), "호텔 근처 편의점");
    await user.clear(screen.getByLabelText("예상비용 (엔)"));
    await user.type(screen.getByLabelText("예상비용 (엔)"), "500");
    await user.click(screen.getByRole("button", { name: "일정 저장" }));

    expect(screen.getByText("편의점 들르기")).toBeVisible();
    expect(screen.getByText("19:30")).toBeVisible();
    expect(screen.getByText("¥500")).toBeVisible();
  });

  it("연결된 일정의 시각을 바꾸면 교통 재확인 상태로 저장한다", async () => {
    const user = userEvent.setup();
    render(<ScheduleHarness />);

    await user.click(
      screen.getByRole("button", { name: "벤텐초 → 우메다 수정" }),
    );
    await user.clear(screen.getByLabelText("시각"));
    await user.type(screen.getByLabelText("시각"), "16:00");
    await user.click(screen.getByRole("button", { name: "일정 저장" }));

    expect(screen.getByText("16:00")).toBeVisible();
    expect(screen.getByText("교통편 재확인 필요")).toBeVisible();
  });

  it("삭제는 명시적인 두 번째 확인 뒤에만 적용한다", async () => {
    const user = userEvent.setup();
    render(<ScheduleHarness />);

    await user.click(
      screen.getByRole("button", {
        name: "Standard Products 우메다 EST 수정",
      }),
    );
    await user.click(screen.getByRole("button", { name: "일정 삭제" }));
    expect(screen.getByText("이 일정을 정말 삭제할까요?")).toBeVisible();
    expect(screen.getByText("Standard Products 우메다 EST")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "정말 삭제" }));
    expect(
      screen.queryByText("Standard Products 우메다 EST"),
    ).not.toBeInTheDocument();
  });

  it("필수 입력 오류를 보여주고 편집기를 유지한다", async () => {
    const user = userEvent.setup();
    render(<ScheduleHarness />);

    await user.click(screen.getByRole("button", { name: "일정 추가" }));
    await user.click(screen.getByRole("button", { name: "일정 저장" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "일정 이름을 확인해주세요.",
    );
    expect(screen.getByRole("heading", { name: "새 일정 등록" })).toBeVisible();
  });

  it("두 장소 사이에는 앱 안 조회 없이 Google 지도 길찾기 링크만 둔다", () => {
    render(
      <ScheduleScreen
        plan={{
          ...basePlan,
          activities: [activityWithPlaceA, activityWithPlaceB],
        }}
        now={new Date("2026-07-21T00:00:00+09:00")}
        onChange={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "경로 조회" })).toBeNull();
    const link = screen.getByRole("link", {
      name: "다음 이동: 우메다 쇼핑 → 오사카성 Google 지도에서 길 보기",
    });
    const url = new URL(link.getAttribute("href") ?? "");
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("origin")).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    expect(url.searchParams.get("destination")).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    expect(
      screen.getByRole("link", { name: "우메다 쇼핑 장소 보기" }),
    ).toHaveAttribute("href", "https://maps.google.com/?cid=1");
  });

  it("좌표가 없는 장소는 장소 이름으로 Google 지도 링크를 만든다", () => {
    const noPlace = { ...activityWithPlaceB };
    delete (noPlace as { place?: unknown }).place;
    render(
      <ScheduleScreen
        plan={{ ...basePlan, activities: [activityWithPlaceA, noPlace] }}
        now={new Date("2026-07-21T00:00:00+09:00")}
        onChange={() => undefined}
      />,
    );
    const link = screen.getByRole("link", {
      name: "다음 이동: 우메다 쇼핑 → 오사카성 Google 지도에서 길 보기",
    });
    expect(
      new URL(link.getAttribute("href") ?? "").searchParams.get("destination"),
    ).toBe(noPlace.placeName);
  });

  it("기본 일정은 정확한 장소 링크와 명시적인 다음 이동을 구분한다", () => {
    render(<ScheduleHarness />);

    expect(
      screen.getByRole("link", {
        name: "TW327 간사이국제공항 T1 도착 장소 보기",
      }),
    ).toHaveAttribute("href", expect.stringContaining("search"));
    expect(
      screen.getByRole("link", {
        name: "다음 이동: TW327 간사이국제공항 T1 도착 → KIX → 벤텐초 Google 지도에서 길 보기",
      }),
    ).toHaveAttribute("href", expect.stringContaining("travelmode=transit"));
  });
});
