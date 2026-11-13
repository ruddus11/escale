import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { osakaLibrarySeed, osakaWorkspaceSeed } from "../data/scheduleSeed";
import { addTrip, emptyTripLibrary } from "../domain/workspace/library";
import { createTrip } from "../domain/workspace/tripForm";
import type { TripLibrary } from "../domain/workspace/types";
import type { TripLibraryRepository } from "../repositories/tripRepository";
import { App } from "./App";
import { AppProviders } from "./AppProviders";

const NOW = new Date("2026-07-17T10:00:00+09:00");

function memoryRepository(initial: TripLibrary = osakaLibrarySeed) {
  let stored = structuredClone(initial);
  return {
    load: vi.fn(async () => structuredClone(stored)),
    save: vi.fn(async (library: TripLibrary) => {
      stored = structuredClone(library);
    }),
    reset: vi.fn(async () => undefined),
    exportJson: vi.fn(() => JSON.stringify(stored)),
    importJson: vi.fn(() => structuredClone(stored)),
    saved: () => stored,
  } satisfies TripLibraryRepository & { saved: () => TripLibrary };
}

function twoTripLibrary(): TripLibrary {
  const winter = createTrip(
    {
      title: "겨울 여행",
      startDate: "2026-12-20",
      endDate: "2026-12-24",
      baseCurrency: "KRW",
      members: [{ name: "나" }, { name: "민지" }],
      coverColor: "ink",
    },
    { id: "winter", now: NOW },
  );
  return addTrip(structuredClone(osakaLibrarySeed), winter);
}

function renderAt(hash: string, repository: TripLibraryRepository) {
  window.history.replaceState(null, "", hash);
  // 실제 앱(main.tsx)처럼 테마와 한국어 문구를 함께 감싼다.
  return render(
    <AppProviders>
      <App now={NOW} workspaceRepository={repository} />
    </AppProviders>,
  );
}

afterEach(() => window.history.replaceState(null, "", "#"));

describe("수첩 틀", () => {
  it("빈 목록은 일본 예시 없이 시작하고 백업 복구에 바로 접근할 수 있다", async () => {
    const user = userEvent.setup();
    renderAt("#today", memoryRepository(emptyTripLibrary()));
    expect(await screen.findByRole("heading", { name: "내 여행 수첩" })).toBeVisible();
    expect(screen.queryByText(/오사카/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "백업 · 복구" }));
    expect(screen.getByRole("button", { name: "백업 내보내기" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /110 전화/ })).not.toBeInTheDocument();
  });
  it("표지에서 새 수첩을 만들면 그 수첩을 펼치고 저장한다", async () => {
    const user = userEvent.setup();
    const repository = memoryRepository();
    renderAt("#covers", repository);

    await user.click(await screen.findByRole("button", { name: "새 수첩 만들기" }));
    await user.click(screen.getByRole("button", { name: "다음: 예약 넣기" }));
    expect(screen.getByText("여행 이름을 적어 주세요.")).toBeVisible();

    await user.type(screen.getByLabelText("여행 이름"), "겨울 여행");
    await user.click(screen.getByRole("button", { name: "동행자 더하기" }));
    await user.type(screen.getByLabelText("동행자 2"), "민지");
    await user.click(screen.getByRole("button", { name: "다음: 예약 넣기" }));
    await user.click(screen.getByRole("button", { name: "수첩 만들기" }));

    expect(
      await screen.findByRole("link", { name: /겨울 여행 수첩, 표지로 가기/ }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "일정" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await waitFor(() => expect(repository.saved().trips).toHaveLength(2));
    expect(repository.saved().trips[1]?.settings.members.map((member) => member.name)).toEqual([
      "나",
      "민지",
    ]);
  });

  it("표지에서 다른 수첩을 고르면 그 수첩을 펼친다", async () => {
    const user = userEvent.setup();
    const repository = memoryRepository(twoTripLibrary());
    renderAt("#covers", repository);

    await user.click(
      await screen.findByRole("button", { name: /오사카·교토 4박 5일 수첩 열기/ }),
    );

    expect(
      screen.getByRole("link", { name: /오사카·교토 4박 5일 수첩, 표지로 가기/ }),
    ).toBeVisible();
    await waitFor(() => expect(repository.saved().activeTripId).toBe("osaka-2026"));
  });

  it("메뉴에서 다 쓴 수첩으로 옮기면 표지 아래 줄로 간다", async () => {
    const user = userEvent.setup();
    const repository = memoryRepository(twoTripLibrary());
    renderAt("#today", repository);

    await user.click(await screen.findByRole("button", { name: "수첩 메뉴" }));
    await user.click(screen.getByRole("button", { name: /다 쓴 수첩으로 옮기기/ }));
    await user.click(screen.getByRole("link", { name: /표지로 가기/ }));

    const finished = await screen.findByRole("region", { name: "다 쓴 수첩" });
    expect(within(finished).getByRole("button", { name: /겨울 여행 수첩 열기/ })).toBeVisible();
  });

  it("수첩 지우기는 확인을 거치고, 지운 뒤 남은 수첩의 표지로 간다", async () => {
    const user = userEvent.setup();
    const repository = memoryRepository(twoTripLibrary());
    renderAt("#today", repository);

    await user.click(await screen.findByRole("button", { name: "수첩 메뉴" }));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /수첩 지우기/ }));
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "지우기" }));

    expect(await screen.findByRole("heading", { name: "내 여행 수첩" })).toBeVisible();
    await waitFor(() => expect(repository.saved().trips.map((trip) => trip.id)).toEqual(["osaka-2026"]));
  });

  it("마지막 한 권도 확인 후 지울 수 있다", async () => {
    const user = userEvent.setup();
    renderAt("#today", memoryRepository());

    await user.click(await screen.findByRole("button", { name: "수첩 메뉴" }));
    await user.click(screen.getByRole("button", { name: /수첩 지우기/ }));
    await user.click(screen.getByRole("button", { name: "지우기" }));
    expect(await screen.findByRole("heading", { name: "내 여행 수첩" })).toBeVisible();
  });

  it("예전 정보 주소는 예약 탭으로 연다", async () => {
    renderAt("#info", memoryRepository());

    expect(await screen.findByRole("heading", { name: "여행 정보" })).toBeVisible();
    expect(screen.getByRole("button", { name: "예약" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("원화 수첩에서도 경비를 기록할 수 있다", async () => {
    renderAt("#budget", memoryRepository(twoTripLibrary()));

    expect(
      await screen.findByRole("heading", { name: "예산" }),
    ).toBeVisible();
  });

  it("오사카가 아닌 수첩의 예약 탭에는 오사카 호텔 정보를 보여 주지 않는다", async () => {
    renderAt("#bookings", memoryRepository(twoTripLibrary()));

    expect(
      await screen.findByRole("heading", { name: "예약 수첩" }),
    ).toBeVisible();
    expect(screen.queryByText(osakaWorkspaceSeed.settings.title)).toBeNull();
  });
});
