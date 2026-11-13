import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleActivity } from "../../domain/schedule/types";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import { ActivityEditor } from "./ActivityEditor";

const plan = osakaWorkspaceSeed.schedule;

const activityWithPlace: ScheduleActivity = {
  id: "user-place-test",
  routeTimingStale: false,
  title: "전망대",
  targetAt: "2026-07-21T10:00:00+09:00",
  placeName: "우메다 스카이빌딩",
  kind: "sightseeing",
  durationMinutes: 60,
  priority: "flexible",
  timeKind: "estimate",
  place: {
    placeId: "ChIJ123",
    displayName: "우메다 스카이빌딩",
    formattedAddress: "오사카시 기타구",
    location: { latitude: 34.7055, longitude: 135.4903 },
    googleMapsUri: "https://maps.google.com/?cid=1",
    attachedAt: "2026-07-17T12:00:00+09:00",
  },
};

describe("ActivityEditor place binding", () => {
  it("drops the attached place when the place name is edited by hand", async () => {
    const onSave = vi.fn();
    render(
      <ActivityEditor
        plan={plan}
        activity={activityWithPlace}
        defaultDate="2026-07-21"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    // The attached place is shown before editing.
    expect(screen.getByText("오사카시 기타구")).toBeInTheDocument();

    const placeInput = screen.getByPlaceholderText("장소 없음도 가능");
    await userEvent.type(placeInput, " 근처");

    await userEvent.click(screen.getByRole("button", { name: "일정 저장" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]![0] as ScheduleActivity;
    expect(saved.place).toBeUndefined();
    expect(saved.placeName).toBe("우메다 스카이빌딩 근처");
  });
});
