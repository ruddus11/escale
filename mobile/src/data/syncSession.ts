import type { NotebookData } from "./model";
import { notebookHash, readRemoteNotebook, type RemoteNotebook, type SyncState } from "./cloudSync";

export type SyncToken = { userId: string; generation: number };

/** 이전 계정 응답을 무효화하고, 기기 쓰기와 로그아웃 정리를 순서대로 처리한다. 네트워크는 큐에 넣지 않는다. */
export function createSyncSession() {
  let active: SyncToken | null = null;
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const current = (token: SyncToken) => active === token;
  const check = (token: SyncToken) => { if (!current(token)) throw new Error("session-ended"); };
  function enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = tail.then(action);
    tail = result.catch(() => undefined);
    return result;
  }
  return {
    activate(userId: string | null) {
      if (active?.userId === userId) return active;
      active = userId ? { userId, generation: ++generation } : null;
      return active;
    },
    token: () => active,
    current,
    check,
    stop() { active = null; },
    run<T>(token: SyncToken, action: () => Promise<T>) {
      return enqueue(async () => { check(token); const result = await action(); check(token); return result; });
    },
    clear: enqueue,
  };
}

/** 저장 직전의 최신 값과 비교해 대기 중 작성한 내용을 지우지 않는다. */
export async function applyRemoteNotebook(
  session: ReturnType<typeof createSyncSession>, token: SyncToken,
  expected: NotebookData, remote: RemoteNotebook,
  commit: (update: (value: NotebookData) => NotebookData) => Promise<void>,
  saveState: (state: SyncState) => Promise<void>,
) {
  const next = readRemoteNotebook(remote);
  const expectedHash = notebookHash(expected);
  await session.run(token, async () => {
    await commit(current => {
      session.check(token);
      if (notebookHash(current) !== expectedHash) throw new Error("local-changed");
      return next;
    });
    session.check(token);
    await saveState({ userId: token.userId, version: remote.version, hash: notebookHash(next) });
  });
}
