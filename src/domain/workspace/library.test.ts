import { describe, expect, it } from "vitest";
import {
  addTrip,
  createTripLibrary,
  getActiveTrip,
  removeTrip,
  replaceTrip,
  selectTrip,
  setTripArchived,
} from "./library";
import type { TripWorkspace } from "./types";

function trip(id: string, updatedAt = "2026-10-01T00:00:00.000Z"): TripWorkspace {
  return {
    id,
    settings: {
      title: id,
      startDate: "2026-10-12",
      endDate: "2026-10-16",
      timeZone: "Asia/Tokyo",
      baseCurrency: "KRW",
      localCurrency: "JPY",
      members: [{ id: "me", name: "나" }],
      ownerId: "me",
    },
    schedule: {
      id,
      schemaVersion: 1,
      seedVersion: 2,
      title: id,
      startDate: "2026-10-12",
      endDate: "2026-10-16",
      timeZone: "Asia/Tokyo",
      currency: "JPY",
      travelerCount: 1,
      activities: [],
      updatedAt,
    },
    budget: { emergencyReserveMinor: 0 },
    ledger: { expenses: [], fundContributions: [], payments: [] },
    updatedAt,
  };
}

describe("수첩 목록", () => {
  it("수첩 한 권으로 목록을 만들고 그 수첩을 펼친다", () => {
    const library = createTripLibrary(trip("autumn"));

    expect(library).toMatchObject({ schemaVersion: 3, activeTripId: "autumn" });
    expect(library.updatedAt).toBe("2026-10-01T00:00:00.000Z");
    expect(getActiveTrip(library).id).toBe("autumn");
  });

  it("새 수첩은 맨 뒤에 더하고 바로 펼친다", () => {
    const library = addTrip(
      createTripLibrary(trip("osaka")),
      trip("autumn", "2026-10-02T00:00:00.000Z"),
    );

    expect(library.trips.map((item) => item.id)).toEqual(["osaka", "autumn"]);
    expect(library.activeTripId).toBe("autumn");
    expect(library.updatedAt).toBe("2026-10-02T00:00:00.000Z");
  });

  it("같은 id의 수첩은 더하지 않는다", () => {
    expect(() => addTrip(createTripLibrary(trip("osaka")), trip("osaka"))).toThrow(
      RangeError,
    );
  });

  it("다른 수첩을 펼쳐도 목록 순서는 그대로다", () => {
    const library = selectTrip(
      addTrip(createTripLibrary(trip("osaka")), trip("autumn")),
      "osaka",
      "2026-10-03T00:00:00.000Z",
    );

    expect(library.activeTripId).toBe("osaka");
    expect(library.trips.map((item) => item.id)).toEqual(["osaka", "autumn"]);
    expect(library.updatedAt).toBe("2026-10-03T00:00:00.000Z");
    expect(() => selectTrip(library, "ghost", "2026-10-03T00:00:00.000Z")).toThrow(
      RangeError,
    );
  });

  it("같은 id의 수첩만 바꾸고 원래 목록은 건드리지 않는다", () => {
    const original = addTrip(createTripLibrary(trip("osaka")), trip("autumn"));
    const changed = { ...trip("osaka", "2026-10-04T00:00:00.000Z"), budget: { emergencyReserveMinor: 3_000 } };

    const library = replaceTrip(original, changed);

    expect(library.trips[0]?.budget.emergencyReserveMinor).toBe(3_000);
    expect(library.trips[1]?.id).toBe("autumn");
    expect(library.updatedAt).toBe("2026-10-04T00:00:00.000Z");
    expect(original.trips[0]?.budget.emergencyReserveMinor).toBe(0);
    expect(() => replaceTrip(original, trip("ghost"))).toThrow(RangeError);
  });

  it("펼친 수첩이 목록에 없으면 알려 준다", () => {
    const library = { ...createTripLibrary(trip("osaka")), activeTripId: "ghost" };
    expect(() => getActiveTrip(library)).toThrow(RangeError);
  });
});

describe("수첩 보관과 지우기", () => {
  it("다 쓴 수첩으로 옮기고 되돌린다", () => {
    const library = addTrip(createTripLibrary(trip("osaka")), trip("autumn"));
    const archived = setTripArchived(library, "osaka", true, "2026-10-05T00:00:00.000Z");

    expect(archived.trips[0]?.settings.archived).toBe(true);
    expect(archived.updatedAt).toBe("2026-10-05T00:00:00.000Z");
    expect(
      setTripArchived(archived, "osaka", false, "2026-10-06T00:00:00.000Z").trips[0]
        ?.settings,
    ).not.toHaveProperty("archived");
  });

  it("펼친 수첩을 지우면 남은 첫 수첩을 펼친다", () => {
    const library = addTrip(createTripLibrary(trip("osaka")), trip("autumn"));
    const removed = removeTrip(library, "autumn", "2026-10-05T00:00:00.000Z");

    expect(removed.trips.map((item) => item.id)).toEqual(["osaka"]);
    expect(removed.activeTripId).toBe("osaka");
  });

  it("마지막 한 권은 지우고 없는 수첩은 거부한다", () => {
    const library = createTripLibrary(trip("osaka"));
    expect(removeTrip(library, "osaka", "2026-10-05T00:00:00.000Z").trips).toEqual([]);
    expect(() => removeTrip(library, "ghost", "2026-10-05T00:00:00.000Z")).toThrow(
      RangeError,
    );
  });
});
