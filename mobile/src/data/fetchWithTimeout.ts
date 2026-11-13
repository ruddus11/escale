// RN의 fetch에는 기본 제한 시간이 없어 신호가 약하면 스피너가 끝나지 않는다. 모든 서버 호출은 이 함수를 거친다.
// 단위는 밀리초. 예: 15_000 = 15초.
export const DEFAULT_TIMEOUT_MS = 15_000;

/** 제한 시간이 지나 요청을 끊었을 때. 부른 쪽은 이것을 "응답이 느려요" 안내로 바꾼다. */
export class FetchTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

export function isFetchTimeout(error: unknown): error is FetchTimeoutError {
  return error instanceof FetchTimeoutError;
}

/**
 * 제한 시간이 있는 fetch. 응답 머리가 올 때까지만 잰다. 본문 읽기는 부른 쪽의 오류 처리에 맡긴다.
 * 부른 쪽이 넘긴 signal로 취소하면 원래 오류를 그대로 던지고, 제한 시간으로 끊었을 때만 FetchTimeoutError를 던진다.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const outer = init.signal;
  const cancel = () => controller.abort();
  if (outer?.aborted) controller.abort();
  outer?.addEventListener("abort", cancel);
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // signal을 무시하는 fetch 구현이어도 제한 시간에는 반드시 끝나도록 경주시킨다.
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new FetchTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([(options.fetchImpl ?? fetch)(url, { ...init, signal: controller.signal }), deadline]);
  } catch (error) {
    if (timedOut) throw new FetchTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", cancel);
  }
}
