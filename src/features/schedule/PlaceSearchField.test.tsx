import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlaceSearchField } from "./PlaceSearchField";

const place = {
  placeId: "ChIJ123",
  displayName: "우메다 스카이빌딩",
  formattedAddress: "오사카시 기타구",
  location: { latitude: 34.7055, longitude: 135.4903 },
  googleMapsUri: "https://maps.google.com/?cid=1",
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function setup(overrides?: Partial<Parameters<typeof PlaceSearchField>[0]>) {
  const onPlaceNameChange = vi.fn();
  const onPlaceSelect = vi.fn();
  const onPlaceClear = vi.fn();
  render(
    <PlaceSearchField
      placeName=""
      onPlaceNameChange={onPlaceNameChange}
      onPlaceSelect={onPlaceSelect}
      onPlaceClear={onPlaceClear}
      {...overrides}
    />,
  );
  return { onPlaceNameChange, onPlaceSelect, onPlaceClear };
}

describe("PlaceSearchField", () => {
  it("asks for the access code when no token is stored", async () => {
    setup({ placeName: "우메다" });
    await userEvent.click(screen.getByRole("button", { name: "장소 검색" }));
    expect(
      screen.getByText(/교통편 탭에서 개인 접근 코드를 먼저 입력/),
    ).toBeInTheDocument();
  });

  it("searches and selects a result", async () => {
    window.localStorage.setItem(
      "osaka-pocket.transit-access-token",
      "t".repeat(24),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            places: [place],
            fetchedAt: "2026-07-20T03:00:00.000Z",
          }),
      } as unknown as Response),
    );
    const { onPlaceSelect } = setup({ placeName: "우메다" });

    await userEvent.click(screen.getByRole("button", { name: "장소 검색" }));
    await waitFor(() =>
      expect(screen.getByText("우메다 스카이빌딩")).toBeInTheDocument(),
    );
    expect(screen.getByText("Google Maps")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /선택/ }));
    expect(onPlaceSelect).toHaveBeenCalledWith(
      expect.objectContaining({ placeId: "ChIJ123" }),
    );
  });

  it("shows the attached place with a clear button", async () => {
    const { onPlaceClear } = setup({
      placeName: "우메다 스카이빌딩",
      place: { ...place, attachedAt: "2026-07-17T12:00:00+09:00" },
    });
    expect(screen.getByText("오사카시 기타구")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "장소 연결 해제" }));
    expect(onPlaceClear).toHaveBeenCalled();
  });

  it("offers a Google Maps fallback on network failure", async () => {
    window.localStorage.setItem(
      "osaka-pocket.transit-access-token",
      "t".repeat(24),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("offline")),
    );
    setup({ placeName: "우메다" });
    await userEvent.click(screen.getByRole("button", { name: "장소 검색" }));
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Google Maps에서 검색/ }),
      ).toBeInTheDocument(),
    );
  });
});
