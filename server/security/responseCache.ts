import { createHash } from "node:crypto";
import type { Clock } from "./costGuard.js";
import { systemClock } from "./costGuard.js";

// 같은 상위 요청(같은 검색어·장소 ID·언어)을 짧게 기억해 유료 API를 다시 부르지 않는다.
// 함수 인스턴스 메모리에서만 수십 분 동안 재사용한다. 디스크·DB에 남기지 않고, Google Places 콘텐츠 보관 제한 때문에 길게 쓰지 않는다.
// 처리방침이 "검색어·취향 원문은 남기지 않는다"고 약속하므로 열쇠는 SHA-256 해시로만 둔다. 계정 ID·IP를 열쇠에 넣지 않는다.
// 만료된 값은 실행 중 타이머로 지우고, 서버리스 함수가 멈췄다면 다음 캐시 접근 때 정리한다.
//
// 같은 열쇠의 요청이 동시에 오면 첫 요청의 결과를 함께 기다린다. 실패한 결과는 기억하지 않는다.

export interface ResponseCache<T> {
  /** 기억한 값 또는 진행 중인 같은 요청. 없으면 undefined. */
  peek(key: string): Promise<T> | undefined;
  /** load를 한 번만 부르고 성공한 값을 ttlMs(없으면 기본값) 동안 기억한다. */
  remember(key: string, load: () => Promise<T>, ttlMs?: number): Promise<T>;
}

export function createResponseCache<T>(options: { ttlMs: number; maxEntries?: number; clock?: Clock; disabled?: boolean }): ResponseCache<T> {
  const clock = options.clock ?? systemClock;
  const maxEntries = options.maxEntries ?? 500;
  const stored = new Map<string, { value: T; expiresAt: number; generation: number }>();
  const pending = new Map<string, Promise<T>>();
  let generation = 0;

  const sweep = (now: number) => {
    for (const [key, entry] of stored) if (entry.expiresAt <= now) stored.delete(key);
  };

  return {
    peek(raw) {
      sweep(clock.now());
      const key = hashKey(raw);
      const entry = stored.get(key);
      if (entry && entry.expiresAt > clock.now()) return Promise.resolve(entry.value);
      if (entry) stored.delete(key);
      return pending.get(key);
    },
    remember(raw, load, ttlMs = options.ttlMs) {
      if (options.disabled || ttlMs <= 0) return load();
      sweep(clock.now());
      const key = hashKey(raw);
      const entry = stored.get(key);
      if (entry && entry.expiresAt > clock.now()) return Promise.resolve(entry.value);
      if (entry) stored.delete(key);
      const running = pending.get(key);
      if (running) return running;
      const promise = load().then(
        (value) => {
          pending.delete(key);
          stored.delete(key);
          sweep(clock.now());
          const currentGeneration = ++generation;
          stored.set(key, { value, expiresAt: clock.now() + ttlMs, generation: currentGeneration });
          // 만료 타이머는 값 자체를 붙잡지 않는다. 교체된 값을 예전 타이머가 지우지 않도록 판을 확인한다.
          const timer = setTimeout(() => {
            if (stored.get(key)?.generation === currentGeneration) stored.delete(key);
          }, ttlMs);
          timer.unref?.();
          // Map은 넣은 순서를 지키므로 맨 앞이 가장 오래된 값이다.
          while (stored.size > maxEntries) stored.delete(stored.keys().next().value as string);
          return value;
        },
        (error: unknown) => {
          pending.delete(key);
          throw error;
        },
      );
      pending.set(key, promise);
      return promise;
    },
  };
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** 열쇠용 글자 정리. 대소문자·전각/반각·연속 공백만 다른 검색어를 같은 요청으로 본다. */
export function normalizeText(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** API_CACHE_OFF=1이면 기억하지 않는다(문제 조사용). */
export function isCacheOff(env: Record<string, string | undefined>): boolean {
  return env.API_CACHE_OFF?.trim() === "1";
}
