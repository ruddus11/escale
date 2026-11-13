import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { osakaLibrarySeed, osakaWorkspaceSeed } from "../data/scheduleSeed";
import type { AppDependencies } from "./App";
import type { TripLibraryRepository } from "../repositories/tripRepository";
import { App as ActualApp } from "./App";
function App(props: React.ComponentProps<typeof ActualApp>) { return <ActualApp workspaceSeed={osakaWorkspaceSeed} {...props} />; }

// 교통편은 탭이 아니라 일정 안의 화면이라, 오늘 카드의 버튼 대신 주소로 바로 연다.
function openScreen(screen: string) {
  act(() => {
    window.history.replaceState(null, "", `#${screen}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

const LIVE_NOW = new Date("2026-07-20T16:43:00+09:00");

function createDependencies() {
  return {
    clock: { now: () => new Date(LIVE_NOW) },
  } satisfies AppDependencies;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("App", () => {
  it("keeps the public legal pages in the web footer on the first screen", () => {
    render(<App now={LIVE_NOW} />);
    const footer = screen.getByRole("contentinfo", { name: "개인정보와 약관" });
    expect(footer).toContainElement(screen.getByRole("link", { name: "개인정보 처리방침" }));
    expect(footer).toContainElement(screen.getByRole("link", { name: "이용약관" }));
    expect(footer).toContainElement(screen.getByRole("link", { name: "계정·데이터 삭제" }));
  });

  it("저장 데이터 확인 전에는 편집 화면을 잠그고 완료 후 연다", async () => {
    const user = userEvent.setup();
    let resolveLoad!: (library: typeof osakaLibrarySeed) => void;
    const loadPromise = new Promise<typeof osakaLibrarySeed>((resolve) => {
      resolveLoad = resolve;
    });
    const repository = {
      load: vi.fn(() => loadPromise),
      save: vi.fn(async () => undefined),
      reset: vi.fn(async () => undefined),
      exportJson: vi.fn((library) => JSON.stringify(library)),
      importJson: vi.fn(() => structuredClone(osakaLibrarySeed)),
    } satisfies TripLibraryRepository;

    render(
      <App
        now={new Date("2026-07-17T03:00:00+09:00")}
        workspaceRepository={repository}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "전체 일정" }));

    expect(screen.getByText("저장된 여행 데이터 확인 중")).toHaveAttribute(
      "role",
      "status",
    );
    expect(
      screen.queryByRole("button", { name: "일정 추가" }),
    ).not.toBeInTheDocument();

    await act(async () => resolveLoad(structuredClone(osakaLibrarySeed)));
    expect(
      await screen.findByRole("button", { name: "일정 추가" }),
    ).toBeVisible();
  });

  it("위쪽 탭과 일정 보기 전환으로 전체 일정·경비·예약 화면을 연다", async () => {
    const user = userEvent.setup();
    render(<App now={new Date("2026-07-17T03:00:00+09:00")} />);

    await user.click(screen.getByRole("radio", { name: "전체 일정" }));
    expect(screen.getByRole("heading", { name: "일정표" })).toBeVisible();
    expect(screen.getByText("TW327 간사이국제공항 T1 도착")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "경비" }));
    expect(screen.getByRole("heading", { name: "예산" })).toBeVisible();
    expect(screen.getByText("¥30,000")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "예약" }));
    expect(screen.getByRole("heading", { name: "여행 정보" })).toBeVisible();
  });

  it("Day 2 이후 교통편 화면에서 전체 일정의 구간 지도로 바로 이동한다", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "osaka-pocket.transit-access-token",
      "saved-test-token",
    );
    render(<App now={new Date("2026-07-21T12:00:00+09:00")} />);

    openScreen("transit");
    expect(screen.getByText(/일정표에서 정확한 구간 지도를/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "전체 일정에서 경로 보기" }),
    );

    expect(screen.getByRole("heading", { name: "일정표" })).toBeVisible();
  });

  it("일정표에서 추가한 수동 일정이 Today의 다음 일정에 즉시 반영된다", async () => {
    const user = userEvent.setup();
    render(<App now={new Date("2026-07-20T19:00:00+09:00")} />);

    await user.click(screen.getByRole("radio", { name: "전체 일정" }));
    await user.click(screen.getByRole("button", { name: "일정 추가" }));
    await user.type(screen.getByLabelText("일정 이름"), "편의점 들르기");
    await user.clear(screen.getByLabelText("시각"));
    await user.type(screen.getByLabelText("시각"), "19:30");
    await user.type(screen.getByLabelText("장소"), "호텔 근처 편의점");
    await user.click(screen.getByRole("button", { name: "일정 저장" }));
    await user.click(screen.getByRole("button", { name: "일정" }));

    expect(screen.getByRole("heading", { name: "편의점 들르기" })).toBeVisible();
    expect(screen.getByText("호텔 근처 편의점")).toBeVisible();
    expect(screen.getByRole("link", { name: "Google Maps" })).toBeVisible();
  });

  it("저장한 일정은 remount와 #schedule 직접 진입 뒤에도 유지된다", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <App now={new Date("2026-07-20T19:00:00+09:00")} />,
    );

    await user.click(screen.getByRole("radio", { name: "전체 일정" }));
    await user.click(screen.getByRole("button", { name: "일정 추가" }));
    await user.type(screen.getByLabelText("일정 이름"), "저장 확인 일정");
    await user.clear(screen.getByLabelText("시각"));
    await user.type(screen.getByLabelText("시각"), "19:40");
    await user.click(screen.getByRole("button", { name: "일정 저장" }));
    await waitFor(() => expect(window.localStorage.length).toBeGreaterThan(0));
    unmount();

    window.history.replaceState(null, "", "#schedule");
    render(<App now={new Date("2026-07-20T19:00:00+09:00")} />);

    expect(await screen.findByText("저장 확인 일정")).toBeVisible();
    expect(screen.getByRole("button", { name: "일정" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("radio", { name: "전체 일정" })).toBeChecked();
  });

  it("주입한 clock으로 Today 카운트다운을 1초마다 갱신하고 unmount 시 정리한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    let currentTime = new Date("2026-07-20T15:33:01+09:00").getTime();
    const dependencies = createDependencies();
    const clockNow = vi.fn(() => new Date(currentTime));
    dependencies.clock.now = clockNow;
    const { unmount } = render(<App dependencies={dependencies} />);

    expect(screen.getByText("04:59 남음")).toBeVisible();

    currentTime += 1_000;
    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.getByText("04:58 남음")).toBeVisible();

    unmount();
    const callsAtUnmount = clockNow.mock.calls.length;
    currentTime += 5_000;
    act(() => vi.advanceTimersByTime(5_000));
    expect(clockNow).toHaveBeenCalledTimes(callsAtUnmount);
  });

  it("Today clock이 일정 경계를 지나면 다음 활동을 즉시 바꾸고 API는 호출하지 않는다", () => {
    vi.useFakeTimers();
    let currentTime = new Date("2026-07-20T16:44:59+09:00").getTime();
    const dependencies = createDependencies();
    dependencies.clock.now = () => new Date(currentTime);
    render(<App dependencies={dependencies} />);

    expect(
      screen.getByRole("heading", { name: "네기야키 야마모토 우메다 EST" }),
    ).toBeVisible();

    currentTime += 1_000;
    act(() => vi.advanceTimersByTime(1_000));

    expect(
      screen.getByRole("heading", { name: "우메다 스카이 빌딩으로 이동" }),
    ).toBeVisible();
  });

  it("고정 now가 있으면 clock과 interval을 사용하지 않는다", () => {
    vi.useFakeTimers();
    const dependencies = createDependencies();
    const clockNow = vi.fn(() => new Date("2026-07-20T16:44:59+09:00"));
    dependencies.clock.now = clockNow;
    render(
      <App
        now={new Date("2026-07-20T15:33:01+09:00")}
        dependencies={dependencies}
      />,
    );

    act(() => vi.advanceTimersByTime(5_000));

    expect(screen.getByText("04:59 남음")).toBeVisible();
    expect(clockNow).not.toHaveBeenCalled();
  });

  it("PDF 기준 오늘 화면과 교통편 진입 행동을 표시한다", () => {
    render(<App now={new Date("2026-07-20T15:33:01+09:00")} />);

    expect(screen.getByRole("heading", { name: "오늘" })).toBeVisible();
    expect(screen.getByText("여행 진행 중")).toBeVisible();
    expect(screen.getByText("벤텐초 → 우메다")).toBeVisible();
    expect(screen.getByText("04:59 남음")).toBeVisible();
    expect(screen.getByText("15:45")).toBeVisible();
    expect(screen.getByText("우메다 스카이 전망대")).toBeVisible();
    expect(screen.getByText("18:30")).toBeVisible();
    expect(screen.getByRole("button", { name: "교통편 보기" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "수첩 칸" })).toBeVisible();
  });

  it("다음 일정이 없으면 오늘 일정 완료 상태를 표시한다", () => {
    render(<App now={new Date("2026-07-20T21:00:00+09:00")} />);

    expect(screen.getByText("오늘 일정 완료")).toBeVisible();
    expect(screen.queryByText("여행 진행 중")).not.toBeInTheDocument();
  });

  it("교통편 화면은 앱 안 조회 없이 Google 지도 길찾기와 접근 코드 입력만 둔다", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App now={LIVE_NOW} />);

    await user.click(screen.getByRole("button", { name: "교통편 보기" }));

    const url = new URL(
      screen
        .getByRole("link", { name: "Google 지도에서 길 보기" })
        .getAttribute("href") ?? "",
    );
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("travelmode")).toBe("transit");
    expect(screen.getByLabelText("개인 접근 코드")).toBeVisible();
    await user.type(screen.getByLabelText("개인 접근 코드"), "test-token");
    await user.click(screen.getByRole("button", { name: "교통편 잠금 해제" }));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("Day 2 이후에도 장소·구간 조회용 접근 코드를 입력할 수 있다", () => {
    render(<App now={new Date("2026-07-21T10:00:00+09:00")} />);

    openScreen("transit");

    expect(screen.getByLabelText("개인 접근 코드")).toBeVisible();
    expect(screen.queryByText("다음 교통 일정이 없습니다.")).toBeNull();
  });

  it("새 서비스 워커가 준비되면 한 번 등록한 업데이트를 사용자가 적용한다", async () => {
    const user = userEvent.setup();
    let updateAvailable = false;
    const listeners = new Set<() => void>();
    const applyUpdate = vi.fn().mockResolvedValue(undefined);
    const pwaUpdateController = {
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot: () => updateAvailable,
      applyUpdate,
    };
    const props = {
      now: LIVE_NOW,
      pwaUpdateController,
      buildVersion: "test-build",
    } as Parameters<typeof App>[0];

    render(
      <StrictMode>
        <App {...props} />
      </StrictMode>,
    );
    expect(screen.queryByText("새 버전 준비됨")).not.toBeInTheDocument();

    act(() => {
      updateAvailable = true;
      listeners.forEach((listener) => listener());
    });

    expect(screen.getByText("새 버전 준비됨")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "지금 적용" }));
    expect(applyUpdate).toHaveBeenCalledOnce();
  });

  it("예약 화면에서 현재 빌드 버전을 확인한다", async () => {
    const user = userEvent.setup();
    const props = {
      now: LIVE_NOW,
      buildVersion: "0.1.0+abc1234",
    } as Parameters<typeof App>[0];

    render(<App {...props} />);
    await user.click(screen.getByRole("button", { name: "예약" }));

    expect(screen.getByLabelText("앱 버전")).toHaveTextContent(
      "0.1.0+abc1234",
    );
  });
});
