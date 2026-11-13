import { beforeEach, describe, expect, it } from "vitest";
import { osakaLibrarySeed } from "../data/scheduleSeed";
import { createBrowserTripRepository } from "./browserTripRepository";
import { TripWorkspaceDataError } from "./tripRepository";

const libraryKey = "osaka-pocket.trip-library.v3";
const legacyKey = "osaka-pocket.trip-workspace.v1";

function createRepository() {
  return createBrowserTripRepository({
    indexedDb: undefined,
    storage: window.localStorage,
  });
}

function legacyWorkspace() {
  return {
    schemaVersion: 1,
    schedule: structuredClone(osakaLibrarySeed.trips[0]!.schedule),
    budget: { emergencyReserveMinor: 5_000 },
    expenses: [
      {
        id: "expense-test",
        amountMinor: 500,
        category: "drink",
        occurredAt: "2026-07-20T15:00:00+09:00",
        note: "물",
      },
    ],
    updatedAt: "2026-07-21T09:00:00.000Z",
  };
}

describe("BrowserTripRepository localStorage 대체 저장", () => {
  beforeEach(() => window.localStorage.clear());

  it("형식 2 원본을 남겨두고 다음 편집부터 별도의 형식 3 키에 저장한다", async () => {
    const old = JSON.stringify({ ...osakaLibrarySeed, schemaVersion: 2 })
      .replaceAll("BudgetMinor", "BudgetYen")
      .replaceAll("ReserveMinor", "ReserveYen")
      .replaceAll("PerPersonMinor", "PerPersonYen")
      .replaceAll("CostMinor", "CostYen");
    window.localStorage.setItem("osaka-pocket.trip-library.v2", old);
    const repository = createRepository();
    const restored = await repository.load();
    await repository.save(restored!);
    expect(window.localStorage.getItem("osaka-pocket.trip-library.v2")).toBe(old);
    expect(JSON.parse(window.localStorage.getItem(libraryKey)!).schemaVersion).toBe(3);
  });

  it("저장한 목록을 독립된 값으로 다시 읽는다", async () => {
    const repository = createRepository();
    const library = structuredClone(osakaLibrarySeed);
    library.trips[0]!.settings.title = "편집한 오사카 여행";

    await repository.save(library);
    library.trips[0]!.settings.title = "저장 뒤 변경";

    const restored = await repository.load();
    expect(restored?.trips[0]?.settings.title).toBe("편집한 오사카 여행");
    expect(restored).not.toBe(library);
    expect(window.localStorage.getItem(libraryKey)).not.toBeNull();
  });

  it("새 저장값이 없으면 예전 형식 1 저장값을 읽어 옮긴다", async () => {
    window.localStorage.setItem(legacyKey, JSON.stringify(legacyWorkspace()));

    const restored = await createRepository().load();

    expect(restored?.schemaVersion).toBe(3);
    expect(restored?.trips[0]?.ledger.expenses[0]).toMatchObject({
      id: "expense-test",
      amount: 500,
      currency: "JPY",
      note: "물",
    });
  });

  it("새 저장값이 있으면 예전 저장값보다 먼저 읽는다", async () => {
    window.localStorage.setItem(legacyKey, JSON.stringify(legacyWorkspace()));
    const repository = createRepository();
    await repository.save(osakaLibrarySeed);

    expect((await repository.load())?.trips[0]?.ledger.expenses).toEqual([]);
  });

  it("저장값이 없으면 null을 돌려주고, 초기화는 새·예전 저장값을 모두 지운다", async () => {
    const repository = createRepository();
    expect(await repository.load()).toBeNull();

    window.localStorage.setItem(legacyKey, JSON.stringify(legacyWorkspace()));
    await repository.save(osakaLibrarySeed);
    await repository.reset();

    expect(await repository.load()).toBeNull();
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it("형식이 틀린 JSON은 지금 데이터를 바꾸지 않는다", async () => {
    const repository = createRepository();
    await repository.save(osakaLibrarySeed);

    expect(() =>
      repository.importJson(JSON.stringify({ ...osakaLibrarySeed, schemaVersion: 999 })),
    ).toThrow(TripWorkspaceDataError);
    expect((await repository.load())?.schemaVersion).toBe(3);
  });

  it("내보내기와 가져오기는 목록 전체를 그대로 보존한다", () => {
    const repository = createRepository();
    const library = structuredClone(osakaLibrarySeed);
    library.trips[0]!.ledger.expenses.push({
      id: "expense-test",
      amount: 500,
      currency: "JPY",
      rateToBase: "1",
      paidBy: { kind: "member", memberId: "me" },
      split: { kind: "even", memberIds: ["me"] },
      category: "drink",
      note: "물",
      occurredAt: "2026-07-20T15:00:00+09:00",
    });

    expect(repository.importJson(repository.exportJson(library))).toEqual(library);
  });

  it("예전 형식 1 백업도 가져온다", () => {
    const restored = createRepository().importJson(JSON.stringify(legacyWorkspace()));
    expect(restored.trips[0]?.id).toBe("osaka-2026");
  });

  it("예약번호나 접근코드처럼 허용하지 않은 최상위 키를 거부한다", () => {
    expect(() =>
      createRepository().importJson(
        JSON.stringify({ ...osakaLibrarySeed, accessToken: "secret" }),
      ),
    ).toThrow(TripWorkspaceDataError);
  });
});
