import { useCallback, useEffect, useRef, useState } from "react";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { todayStore } from "./sqlite";
import { emptyPassport, issueStamps, returnDayReached, setTripCancelled, setTripCompleted, type PassportStamp, type PassportState } from "./passport";
import { createPassportStore } from "./passportStore";
import type { Lang } from "../i18n/strings";

/** 도장 발급과 완료·취소 변경이 서로 덮어쓰지 않도록 같은 저장 경로를 쓴다. */
export function usePassport(trips: TripWorkspace[] | undefined, now: Date, lang: Lang) {
  const repository = useRef<ReturnType<typeof createPassportStore> | null>(null);
  if (!repository.current) repository.current = createPassportStore(todayStore);
  const [state, setState] = useState<PassportState>(emptyPassport);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [issued, setIssued] = useState<PassportStamp[]>([]);

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    repository.current!.load().then(
      (value) => { if (alive) { setState(value); setReady(true); } },
      () => { if (alive) setLoadError(true); },
    );
    return () => { alive = false; };
  }, [loadAttempt]);

  const commit = useCallback(async (change: (state: PassportState) => PassportState) => {
    const next = await repository.current!.update(change);
    setState(next);
    setSaveError(false);
    return next;
  }, []);

  const minute = Math.floor(now.getTime() / 60000);
  useEffect(() => {
    if (!ready || !trips) return;
    const result = issueStamps(trips, state, new Date(minute * 60000), lang);
    if (result.state === state) return;
    // 저장이 성공한 뒤에만 도장과 알림을 노출한다. 실패하면 다음 분 또는 재시도 때 다시 발급한다.
    void commit((current) => issueStamps(trips, current, new Date(minute * 60000), lang).state).then(
      () => { if (result.issued.length) setIssued(result.issued); },
      () => setSaveError(true),
    );
  }, [ready, trips, minute, state, lang, commit, saveAttempt]);

  const setCancelled = useCallback(async (tripId: string, cancelled: boolean) => {
    if (!ready) throw new Error("여권을 불러오는 중이에요.");
    await commit((current) => issueStamps(trips ?? [], setTripCancelled(current, tripId, cancelled), now, lang).state);
  }, [ready, trips, now, lang, commit]);

  const setCompleted = useCallback(async (tripId: string, completed: boolean) => {
    if (!ready) throw new Error("여권을 불러오는 중이에요.");
    const trip = trips?.find((item) => item.id === tripId);
    if (!trip || !returnDayReached(trip, now)) throw new Error("귀국일부터 완료할 수 있어요.");
    let newlyIssued: PassportStamp[] = [];
    await commit((current) => {
      const result = issueStamps(trips!, setTripCompleted(current, tripId, completed), now, lang);
      newlyIssued = result.issued;
      return result.state;
    });
    if (newlyIssued.length) setIssued(newlyIssued);
  }, [ready, trips, now, lang, commit]);

  return { state, ready, loadError, saveError, retryLoad: () => setLoadAttempt((value) => value + 1), retrySave: () => setSaveAttempt((value) => value + 1), issued, setCompleted, clearIssued: () => setIssued([]), setCancelled };
}
