import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AppProviders } from "./AppProviders";
import { emptyTripLibrary, addTrip, createTripLibrary } from "../domain/workspace/library";
import { createTrip } from "../domain/workspace/tripForm";
import type { TripLibrary } from "../domain/workspace/types";
import { parseTripLibrary } from "../repositories/tripRepository";

const NOW = new Date("2026-10-08T10:00:00+09:00");
function repository(initial = emptyTripLibrary()) {
  let data = structuredClone(initial);
  return { load: vi.fn(async () => structuredClone(data)), save: vi.fn(async (next: TripLibrary) => { data = parseTripLibrary(next); }), reset: vi.fn(async () => {}), exportJson: () => JSON.stringify(data), importJson: (json: string) => parseTripLibrary(JSON.parse(json)), saved: () => data };
}
function mount(repo: ReturnType<typeof repository>, hash: string) {
  window.history.replaceState(null, "", hash);
  return render(<AppProviders><App workspaceRepository={repo} now={NOW} /></AppProviders>);
}
afterEach(() => window.history.replaceState(null, "", "#"));

describe("예약을 넣고 다시 꺼내 보는 수첩", () => {
  it("생성 단계에서 여러 예약을 넣고, 재실행 후 상세·수정·원본 확인·삭제가 이어진다", async () => {
    const user = userEvent.setup();
    const repo = repository();
    const app = mount(repo, "#new-trip");
    await user.type(await screen.findByLabelText("여행 이름"), "가을 기록");
    await user.click(screen.getByRole("button", { name: "다음: 예약 넣기" }));
    await user.click(screen.getByRole("button", { name: "＋ 숙소" }));
    await user.type(screen.getByLabelText("예약 이름"), "바다 숙소");
    fireEvent.change(screen.getByLabelText("체크인 날짜"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText("체크아웃 날짜 (선택)"), { target: { value: "2026-10-10" } });
    await user.type(screen.getByLabelText("숙소 주소 (선택)"), "예시 해안로 10");
    expect(screen.getByRole("button", { name: "수첩 만들기" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "예약 저장" }));
    await user.click(screen.getByRole("button", { name: "＋ 입장·체험" }));
    await user.type(screen.getByLabelText("예약 이름"), "전시 관람");
    await user.click(screen.getByRole("button", { name: "예약 저장" }));
    await user.click(screen.getByRole("button", { name: "수첩 만들기" }));
    expect(await screen.findByRole("button", { name: "바다 숙소 예약 바로보기" })).toBeVisible();
    await waitFor(() => expect(repo.saved().trips[0]?.reservations).toHaveLength(2));
    app.unmount();
    mount(repo, "#today");
    await user.click(await screen.findByRole("button", { name: "바다 숙소 예약 바로보기" }));
    const detail = screen.getByRole("region", { name: "바다 숙소 예약 상세" });
    expect(within(detail).getByText("예시 해안로 10")).toBeVisible();
    expect(within(detail).getByRole("link", { name: /지도 열기/ })).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(within(detail).getByRole("button", { name: "원본과 대조했어요" }));
    await waitFor(() => expect(repo.saved().trips[0]?.reservations?.[0]?.verifiedAt).toBeDefined());
    await user.click(within(detail).getByRole("button", { name: "수정" }));
    await user.clear(screen.getByLabelText("예약 이름"));
    await user.type(screen.getByLabelText("예약 이름"), "바다 숙소 변경");
    await user.click(screen.getByRole("button", { name: "예약 저장" }));
    await waitFor(() => expect(repo.saved().trips[0]?.reservations?.[0]?.verifiedAt).toBeUndefined());
    await user.click(screen.getByRole("button", { name: "바다 숙소 변경 예약 열기" }));
    await user.click(screen.getByRole("button", { name: "예약 정보 지우기" }));
    expect(repo.saved().trips[0]?.reservations).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "수첩에서 지우기" }));
    await waitFor(() => expect(repo.saved().trips[0]?.reservations).toHaveLength(1));
  });
  it("예약은 선택한 수첩에만 저장되며 입력 오류를 고쳐도 초안이 유지된다", async () => {
    const make = (id: string) => createTrip({ title: id, startDate: "2026-10-08", endDate: "2026-10-11", timeZone: "Asia/Seoul", baseCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink" }, { id, now: NOW });
    const repo = repository(addTrip(createTripLibrary(make("first")), make("second")));
    const user = userEvent.setup();
    mount(repo, "#bookings");
    await user.click(await screen.findByRole("button", { name: "＋ 항공" }));
    await user.type(screen.getByLabelText("예약 이름"), "비행기");
    await user.click(screen.getByText("안내와 서비스 링크 더하기"));
    await user.type(screen.getByLabelText("예약 서비스 홈페이지 (선택)"), "https://example.com/?token=secret");
    await user.click(screen.getByRole("button", { name: "예약 저장" }));
    expect(screen.getByRole("alert")).toHaveTextContent("개별 예약 링크는 저장하지 않아요");
    expect(screen.getByLabelText("예약 이름")).toHaveValue("비행기");
    expect(repo.saved().trips[1]?.reservations).toEqual([]);
    await user.clear(screen.getByLabelText("예약 서비스 홈페이지 (선택)"));
    await user.type(screen.getByLabelText("예약 서비스 홈페이지 (선택)"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "예약 저장" }));
    await waitFor(() => expect(repo.saved().trips[1]?.reservations).toHaveLength(1));
    expect(repo.saved().trips[0]?.reservations).toEqual([]);
  });
});
