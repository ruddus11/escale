import { createTripLibrary } from "../domain/workspace/library";
import type { TripLibrary } from "../domain/workspace/types";
import { upgradeLegacyWorkspace } from "../domain/workspace/upgradeLegacyWorkspace";
import { isTripLibrary } from "./tripLibrarySchema";
import { isLegacyTripWorkspace } from "./workspaceSchema";
import { isRecordWithOnlyKeys } from "./schemaGuards";

export interface TripLibraryRepository {
  load(): Promise<TripLibrary | null>;
  save(library: TripLibrary): Promise<void>;
  reset(): Promise<void>;
  exportJson(library: TripLibrary): string;
  importJson(json: string): TripLibrary;
}

export class TripWorkspaceDataError extends Error {
  constructor(message = "여행 데이터 형식을 확인해주세요.") {
    super(message);
    this.name = "TripWorkspaceDataError";
  }
}

/**
 * 저장값과 백업을 저장 형식 3 목록으로 읽는다.
 * 형식 1(오사카 여행 하나)이면 수첩 한 권짜리 목록으로 옮긴 뒤 같은 검사를 다시 한다.
 */
export function parseTripLibrary(value: unknown): TripLibrary {
  value = upgradeStorageKeys(value);
  if (isTripLibrary(value)) return structuredClone(value);

  if (isLegacyTripWorkspace(value)) {
    const upgraded = createTripLibrary(upgradeLegacyWorkspace(value));
    if (isTripLibrary(upgraded)) return upgraded;
  }

  throw new TripWorkspaceDataError();
}

/** 기존 엔화 필드는 단위가 같으므로 값은 그대로 두고 이름만 이전한다. 원본 객체는 수정하지 않는다. */
function upgradeStorageKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object" || !("schemaVersion" in value) ||
    (value.schemaVersion !== 1 && value.schemaVersion !== 2)) return value;
  const names: Record<string, string> = {
    totalBudgetYen: "totalBudgetMinor",
    emergencyReserveYen: "emergencyReserveMinor",
    mealBudgetPerPersonYen: "mealBudgetPerPersonMinor",
    estimatedCostYen: "estimatedCostMinor",
    amountYen: "amountMinor",
  };
  function copy(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(copy);
    if (item === null || typeof item !== "object") return item;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(item)) {
      const next = names[key] ?? key;
      if (Object.hasOwn(result, next)) throw new TripWorkspaceDataError();
      Object.defineProperty(result, next, { value: copy(val), enumerable: true, writable: true, configurable: true });
    }
    return result;
  }
  const output = copy(value);
  if (output && typeof output === "object" && "schemaVersion" in output &&
    output.schemaVersion === 2 && "trips" in output && Array.isArray(output.trips)) {
    for (const trip of output.trips) preserveLegacyBudget(trip);
    output.schemaVersion = 3;
  }
  return output;
}

function preserveLegacyBudget(value: unknown): void {
  if (!isRecordWithOnlyKeys(value, ["id", "settings", "schedule", "budget", "ledger", "routeSegments", "updatedAt"]) ||
    !value.settings || typeof value.settings !== "object" || !("baseCurrency" in value.settings) ||
    value.settings.baseCurrency === "JPY" || !value.budget || typeof value.budget !== "object") return;

  // 형식 2의 예산은 설정 통화와 무관하게 엔화였다. 장부 기준 통화는 바꾸지 않는다.
  const budget = value.budget as Record<string, unknown>;
  if (budget.totalBudgetMinor !== undefined || budget.mealBudgetPerPersonMinor !== undefined ||
    budget.emergencyReserveMinor !== 0) {
    value.legacyYenBudget = value.budget;
    value.budget = { emergencyReserveMinor: 0 };
  }
}
