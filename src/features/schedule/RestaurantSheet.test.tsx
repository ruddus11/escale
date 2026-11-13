import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleActivity } from "../../domain/schedule/types";
import { RestaurantSheet } from "./RestaurantSheet";

const anchor: ScheduleActivity = {
  id: "a-1",
  routeTimingStale: false,
  title: "우메다 쇼핑",
  targetAt: "2026-07-21T12:00:00+09:00",
  placeName: "우메다",
  kind: "shopping",
  durationMinutes: 60,
  priority: "flexible",
  timeKind: "estimate",
  place: {
    placeId: "p-1",
    displayName: "우메다",
    formattedAddress: "오사카",
    location: { latitude: 34.7025, longitude: 135.496 },
    googleMapsUri: "https://maps.google.com/?cid=1",
    attachedAt: "2026-07-17T12:00:00+09:00",
  },
};

const restaurant = {
  placeId: "r-1",
  displayName: "네기야키 야마모토",
  formattedAddress: "오사카시",
  location: { latitude: 34.703, longitude: 135.497 },
  googleMapsUri: "https://maps.google.com/?cid=2",
  rating: 4.4,
  userRatingCount: 1200,
  priceLevel: 2 as const,
  openNow: true,
  distanceMeters: 120,
};

function stubFetch(restaurants: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        restaurants,
        fetchedAt: "2026-07-21T03:00:00.000Z",
      }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  window.localStorage.setItem(
    "osaka-pocket.transit-access-token",
    "t".repeat(24),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("RestaurantSheet", () => {
  it("moves keyboard focus into the sheet and restores it when Escape closes", async () => {
    stubFetch([]);
    const onClose = vi.fn();
    const launcher = document.createElement("button");
    launcher.textContent = "주변 맛집 열기";
    document.body.append(launcher);
    launcher.focus();
    const { unmount } = render(<RestaurantSheet anchor={anchor} onAdd={vi.fn()} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal");
    await userEvent.tab({ shift: true });
    expect(launcher).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(launcher).toHaveFocus();
    launcher.remove();
  });

  it("lists candidates with rating, distance, and attribution", async () => {
    stubFetch([restaurant]);
    render(
      <RestaurantSheet anchor={anchor} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByText("네기야키 야마모토")).toBeInTheDocument(),
    );
    expect(screen.getByText(/4\.4/)).toBeInTheDocument();
    expect(screen.getByText(/120m/)).toBeInTheDocument();
    expect(screen.getByText(/현재 영업/)).toBeInTheDocument();
    expect(screen.getAllByText("Google Maps").length).toBeGreaterThan(0);
  });

  it("adds a meal activity 30 minutes after the anchor with confirmation", async () => {
    stubFetch([restaurant]);
    const onAdd = vi.fn();
    render(
      <RestaurantSheet
        anchor={anchor}
        onAdd={onAdd}
        onClose={vi.fn()}
        idFactory={() => "fixed"}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("네기야키 야마모토")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /일정에 추가/ }));
    await userEvent.click(screen.getByRole("button", { name: "추가 확정" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-fixed",
        kind: "meal",
        title: "네기야키 야마모토",
        targetAt: "2026-07-21T12:30:00+09:00",
        place: expect.objectContaining({ placeId: "r-1" }),
      }),
    );
  });

  it("offers a wide retry when the near search is empty", async () => {
    const fetchMock = stubFetch([]);
    render(
      <RestaurantSheet anchor={anchor} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /1\.5km로 넓혀 다시 찾기/ }),
      ).toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /1\.5km로 넓혀 다시 찾기/ }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string,
    ) as { radius: string };
    expect(secondBody.radius).toBe("wide");
  });

  it("offers a Google Maps fallback when the search fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(
      <RestaurantSheet anchor={anchor} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Google Maps에서 직접 검색/ }),
      ).toBeInTheDocument(),
    );
  });

  it("asks for the access code when no token is stored", async () => {
    window.localStorage.clear();
    render(
      <RestaurantSheet anchor={anchor} onAdd={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/교통편 탭에서 개인 접근 코드를 먼저 입력/),
      ).toBeInTheDocument(),
    );
  });
});
