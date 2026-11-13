import { useState, useSyncExternalStore } from "react";

export interface PwaUpdateController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
  applyUpdate(): Promise<void>;
}

type ApplyRegisteredUpdate = (reloadPage?: boolean) => Promise<void>;
type RegisterPwaUpdate = (
  onNeedRefresh: () => void,
) => ApplyRegisteredUpdate;

export function createPwaUpdateController(
  registerUpdate: RegisterPwaUpdate,
): PwaUpdateController {
  let isUpdateAvailable = false;
  const listeners = new Set<() => void>();
  const applyRegisteredUpdate = registerUpdate(() => {
    if (isUpdateAvailable) return;

    isUpdateAvailable = true;
    listeners.forEach((listener) => listener());
  });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => isUpdateAvailable,
    applyUpdate: () => applyRegisteredUpdate(true),
  };
}

interface PwaUpdatePromptProps {
  controller: PwaUpdateController;
}

export function PwaUpdatePrompt({ controller }: PwaUpdatePromptProps) {
  const isUpdateAvailable = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    getServerSnapshot,
  );
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isUpdateAvailable) return null;

  async function applyUpdate() {
    setIsApplying(true);
    setError(null);

    try {
      await controller.applyUpdate();
    } catch {
      setIsApplying(false);
      setError("업데이트를 적용하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <aside className="pwa-update-prompt" aria-label="앱 업데이트">
      <div>
        <strong role="status" aria-live="polite">
          새 버전 준비됨
        </strong>
        <span>최신 일정과 기능을 적용할 수 있어요.</span>
        {error === null ? null : <span role="alert">{error}</span>}
      </div>
      <button type="button" onClick={applyUpdate} disabled={isApplying}>
        {isApplying ? "적용 중…" : "지금 적용"}
      </button>
    </aside>
  );
}

function getServerSnapshot() {
  return false;
}
