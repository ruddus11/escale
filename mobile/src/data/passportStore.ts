import { parsePassport, type PassportState } from "./passport";

interface Storage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

const KEY = "passport:v1";

/** 읽기 성공 전에는 쓰지 않고, 저장에 성공한 상태만 다음 변경의 기준으로 삼는다. */
export function createPassportStore(storage: Storage) {
  let current: PassportState | null = null;
  let busy = false;
  return {
    async load(): Promise<PassportState> {
      if (busy) throw new Error("여권을 저장하는 중이에요.");
      const next = parsePassport(await storage.get(KEY));
      current = next;
      return next;
    },
    async update(change: (state: PassportState) => PassportState): Promise<PassportState> {
      if (!current || busy) throw new Error("여권을 준비하는 중이에요. 잠시 후 다시 시도해 주세요.");
      busy = true;
      try {
        const next = change(current);
        if (next !== current) await storage.set(KEY, JSON.stringify(next));
        current = next;
        return next;
      } finally {
        busy = false;
      }
    },
  };
}
