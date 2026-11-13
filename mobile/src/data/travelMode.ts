// 예전 버전의 여행 방식(j 계획형 / p 즉흥형). Escale에서는 고르지 않지만, 기기 설정(app_settings)에 남은 값은
// 지우지 않고 그대로 둔다. 여행을 지울 때만 그 여행의 값을 함께 지운다.
// 키: mode:default(기기 기본값), mode:quiz(첫 실행 퀴즈를 봤는지), mode:trip:<tripId>(여행별).
export type TravelMode = "j" | "p";

export function parseMode(value: string | null | undefined): TravelMode | null {
  return value === "j" || value === "p" ? value : null;
}

export interface ModeKV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createModeStore(kv: ModeKV) {
  const tripKey = (tripId: string) => `mode:trip:${tripId}`;
  return {
    async tripMode(tripId: string) {
      return parseMode(await kv.get(tripKey(tripId)));
    },
    async forgetTrip(tripId: string) {
      await kv.remove(tripKey(tripId));
    },
  };
}
export type ModeStore = ReturnType<typeof createModeStore>;
