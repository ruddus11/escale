/** 기기에 남은 수첩의 계정과 새 세션이 다르면 동기화를 막는다. */
export function accountChange(owner: string | null, nextUserId: string): "new" | "same" | "switch" {
  return owner === null ? "new" : owner === nextUserId ? "same" : "switch";
}

/** 계정 전환을 발견하면 이전 소유자를 유지해 재시작 후에도 동기화가 막히게 한다. */
export async function prepareNotebookOwner(nextUserId: string, store: {
  load: () => Promise<string | null>;
  save: (userId: string) => Promise<void>;
}): Promise<"new" | "same" | "switch"> {
  const change = accountChange(await store.load(), nextUserId);
  if (change !== "switch") await store.save(nextUserId);
  return change;
}

/**
 * 소유자 확인 결과를 화면 상태로 바꾼다. 확인 자체가 실패하면 동기화만 멈추고 전환 화면은 띄우지 않는다.
 * 같은 사람이 "이전 계정 데이터 지우기"를 눌러 자기 수첩을 잃지 않게 하기 위해서다.
 */
export async function notebookOwnerGate(nextUserId: string, store: Parameters<typeof prepareNotebookOwner>[1]): Promise<"sync" | "switch" | "blocked"> {
  try {
    return (await prepareNotebookOwner(nextUserId, store)) === "switch" ? "switch" : "sync";
  } catch {
    return "blocked";
  }
}

/** 인증 해제가 성공한 뒤에만 기기 수첩과 사진을 순서대로 지운다. */
export async function signOutThenClear(actions: {
  signOut: () => Promise<void>;
  localSignOut: () => Promise<void>;
  clearNotebook: () => Promise<void>;
  clearPhotos: () => void;
}): Promise<void> {
  try {
    await actions.signOut();
  } catch {
    await actions.localSignOut();
  }
  await actions.clearNotebook();
  actions.clearPhotos();
}
