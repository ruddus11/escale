import { clearVoiceFiles } from "./diaryMemoryStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking } from "react-native";
import { AuthError, completeSignInFromUrl, signOut } from "./auth";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { notebookOwnerStore, placeCacheStore, syncStateStore, todayStore } from "./sqlite";
import { notebookOwnerGate, signOutThenClear } from "./accountBoundary";
import { clearHeroPhotos } from "./heroPhoto";
import { clearDayPhotos } from "./dayPhotoStore";
import { forgetCandidates } from "./recommendLoad";
import { emptyNotebook, type NotebookData } from "./model";
import { applyRemoteNotebook, createSyncSession, type SyncToken } from "./syncSession";
import { useI18n } from "../i18n/I18n";
import {
  isBackedUp,
  mergeNotebooks,
  notebookHash,
  parseSyncState,
  planSync,
  readRemoteNotebook,
  type RemoteNotebook,
  type SyncState,
} from "./cloudSync";

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "conflict" | "error";

// 저장할 때마다 바로 올리지 않고 입력이 잠시 멈추면 올린다.
const UPLOAD_DELAY_MS = 2500;

interface NotebookStore {
  data: NotebookData | null;
  commit: (update: (value: NotebookData) => NotebookData) => Promise<void>;
}

/** 로그인 세션, 유료 권한, 수첩 계정 백업을 관리한다. supabase 설정이 없으면 모두 꺼진 상태. */
export function useAccount(store: NotebookStore) {
  // 링크로 로그인할 때 뜨는 알림도 지금 고른 언어를 따른다. 효과 안에서 쓰므로 ref로 잡는다.
  const { t: translate } = useI18n();
  const tr = useRef(translate);
  tr.current = translate;
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [premium, setPremium] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("off");
  const [conflict, setConflict] = useState<RemoteNotebook | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  // 고른 사이에 다른 기기가 계정에 올려 다시 골라야 할 때 true.
  const [conflictChanged, setConflictChanged] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(false);
  const data = useRef(store.data);
  data.current = store.data;
  // store 객체는 렌더마다 새로 만들어져서, 동기화 함수가 매번 바뀌지 않도록 ref로 잡는다.
  const commit = useRef(store.commit);
  commit.current = store.commit;
  const running = useRef(false);
  const again = useRef(false);
  // 로그아웃하며 기기 수첩을 지우는 동안 빈 수첩이 계정에 올라가지 않게 동기화를 멈춘다.
  const stopped = useRef(false);
  const signingOut = useRef(false);
  const boundary = useRef(createSyncSession()).current;
  const syncLatest = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!supabase) return;
    let disposed = false;
    let receivedEvent = false;
    let sequence = 0;
    const accept = async (next: Session | null) => {
      const currentSequence = ++sequence;
      // 소유자를 확인하지 못하면(blocked) 동기화만 멈춘다. 다음 인증 이벤트에서 다시 확인한다.
      const gate = next ? await notebookOwnerGate(next.user.id, notebookOwnerStore) : "sync";
      const switchNeeded = gate === "switch";
      if (disposed || currentSequence !== sequence) return;
      // 인증 콜백에서 바로 무효화한다. React가 다시 렌더할 때까지 기다리지 않는다.
      if (!signingOut.current && gate === "sync") boundary.activate(next?.user.id ?? null);
      else boundary.stop();
      stopped.current = gate !== "sync" || signingOut.current;
      setPendingSwitch(switchNeeded);
      setSession(next);
      setReady(!signingOut.current);
    };
    supabase.auth.getSession().then(({ data }) => { if (!receivedEvent) void accept(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => { receivedEvent = true; void accept(next); });
    return () => { disposed = true; boundary.stop(); sub.subscription.unsubscribe(); };
  }, []);

  // 메일의 로그인 링크(travelpouch://auth-callback?code=…)로 앱이 열리면 로그인을 마친다.
  useEffect(() => {
    if (!supabase) return;
    const handle = (url: string | null) => {
      if (!url) return;
      completeSignInFromUrl(url).catch((e) =>
        Alert.alert(tr.current("auth.signInFailed"), e instanceof AuthError ? tr.current(e.key) : tr.current("common.tryLater")),
      );
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const userId = session?.user.id ?? null;

  // 유료 권한은 서버(결제 검증)가 쓰고 앱은 읽기만 한다. 실제 기능 호출도 서버가 다시 확인한다.
  useEffect(() => {
    if (!supabase || !userId) {
      setPremium(false);
      return;
    }
    let canceled = false;
    const token = boundary.token();
    supabase.from("entitlements").select("premium, expires_at").eq("user_id", userId).maybeSingle()
      .then(({ data: row }) => {
        if (!canceled && token && boundary.current(token)) setPremium(!!row?.premium && (row.expires_at === null || Date.parse(row.expires_at) > Date.now()));
      });
    return () => { canceled = true; };
  }, [userId]);

  const saveState = (state: SyncState) => syncStateStore.save(JSON.stringify(state));

  const upload = useCallback(
    async (token: SyncToken, local: NotebookData, baseVersion: number | null) => {
      boundary.check(token);
      const uid = token.userId;
      const hash = notebookHash(local);
      if (baseVersion === null) {
        const { error } = await supabase!.from("notebooks").insert({ user_id: uid, payload: local, version: 1 });
        if (error) return false;
        await boundary.run(token, () => saveState({ userId: uid, version: 1, hash }));
        return true;
      }
      // 마지막으로 본 version일 때만 덮어쓴다. 그새 다른 기기가 올렸으면 0행이 바뀌고 다시 계획한다.
      const { data: rows, error } = await supabase!
        .from("notebooks")
        .update({ payload: local, version: baseVersion + 1, updated_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("version", baseVersion)
        .select("version");
      if (error || !rows?.length) return false;
      await boundary.run(token, () => saveState({ userId: uid, version: baseVersion + 1, hash }));
      return true;
    },
    [],
  );

  const download = useCallback(
    (token: SyncToken, expected: NotebookData, remote: RemoteNotebook) =>
      applyRemoteNotebook(boundary, token, expected, remote, update => commit.current(update), saveState),
    [],
  );

  const sync = useCallback(async () => {
    if (!supabase || !userId || !data.current || stopped.current || pendingSwitch) return;
    const token = boundary.token();
    if (!token || token.userId !== userId) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus("syncing");
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        boundary.check(token);
        const state = parseSyncState(await boundary.run(token, () => syncStateStore.load()));
        boundary.check(token);
        const { data: row, error } = await supabase
          .from("notebooks")
          .select("version, payload")
          .eq("user_id", userId)
          .maybeSingle();
        boundary.check(token);
        if (error) {
          setStatus("offline");
          return;
        }
        // 서버를 기다리는 동안 작성한 내용까지 포함해 다시 판단한다.
        const local = data.current!;
        const plan = planSync(userId, local, state, row);
        if (plan.kind === "conflict") {
          setConflict(plan.remote);
          setStatus("conflict");
          return;
        }
        if (plan.kind === "none") {
          if (plan.adopt) await boundary.run(token, () => saveState(plan.adopt!));
        } else if (plan.kind === "download") {
          await download(token, local, plan.remote);
        } else if (!(await upload(token, local, plan.kind === "create" ? null : plan.baseVersion))) {
          continue;
        }
        boundary.check(token);
        setConflict(null);
        setStatus("synced");
        setSyncedAt(new Date());
        return;
      }
      if (boundary.current(token)) setStatus("error");
    } catch (error) {
      if (boundary.current(token)) {
        if (error instanceof Error && error.message === "local-changed") again.current = true;
        else setStatus("error");
      }
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void syncLatest.current();
      }
    }
  }, [userId, pendingSwitch, upload, download]);
  syncLatest.current = sync;

  // 충돌 해결: 이 기기 수첩으로 서버를 덮거나, 서버 수첩으로 이 기기를 덮거나, 둘을 합친다.
  const resolveConflict = useCallback(
    async (keep: "device" | "account" | "both") => {
      const token = boundary.token();
      if (!userId || !token || token.userId !== userId || !conflict || !data.current || running.current) return;
      const expected = data.current;
      running.current = true;
      setStatus("syncing");
      setConflictChanged(false);
      try {
        if (keep === "account") await download(token, expected, conflict);
        else if (keep === "device") {
          if (!(await upload(token, expected, conflict.version))) throw new Error("changed");
        } else {
          // 둘 다 남기기는 아무것도 잃지 않으므로, 누르는 순간 계정의 최신 수첩을 다시 받아 합친다.
          // 그새 다른 기기가 또 올렸으면 그 내용까지 다시 합쳐 몇 번 더 올린다.
          let base = expected;
          for (let attempt = 0; ; attempt++) {
            const { data: row, error } = await supabase!
              .from("notebooks")
              .select("version, payload")
              .eq("user_id", token.userId)
              .maybeSingle();
            boundary.check(token);
            if (error) throw new Error("offline");
            const remote = row as RemoteNotebook | null;
            const merged = remote ? mergeNotebooks(base, readRemoteNotebook(remote), new Date()) : base;
            // 합친 수첩을 기기에 먼저 저장한다. 올리지 못해도 합친 내용이 남고, 다시 합쳐도 잃는 것이 없다.
            if (merged !== base) {
              const before = base;
              await boundary.run(token, () =>
                commit.current((current) => {
                  boundary.check(token);
                  if (notebookHash(current) !== notebookHash(before)) throw new Error("local-changed");
                  return merged;
                }),
              );
              base = merged;
            }
            if (await upload(token, base, remote ? remote.version : null)) break;
            if (attempt >= 2) throw new Error("changed");
          }
        }
        boundary.check(token);
        setConflict(null);
        setStatus("synced");
        setSyncedAt(new Date());
      } catch (error) {
        if (boundary.current(token)) {
          setStatus("error");
          // 고르는 사이 계정이나 이 기기 수첩이 바뀌었으면 최신 내용으로 다시 비교해 다시 고르게 한다.
          if (error instanceof Error && (error.message === "changed" || error.message === "local-changed")) {
            setConflictChanged(true);
            again.current = true;
          }
        }
      } finally {
        running.current = false;
        if (again.current) { again.current = false; void syncLatest.current(); }
      }
    },
    [userId, conflict, upload, download],
  );

  useEffect(() => {
    if (!userId || pendingSwitch) {
      setStatus("off");
      setConflict(null);
      setConflictChanged(false);
      return;
    }
    stopped.current = false;
    boundary.activate(userId);
    void sync();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void sync());
    return () => sub.remove();
  }, [userId, pendingSwitch, sync]);

  // 수첩이 바뀌면 잠시 뒤 올린다. 충돌을 고르는 중에는 멈춘다.
  useEffect(() => {
    if (!userId || pendingSwitch || !store.data || conflict) return;
    const timer = setTimeout(() => void sync(), UPLOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [store.data, userId, pendingSwitch, conflict, sync]);

  /** 마지막 변경까지 계정에 올리고, 이 기기 수첩이 계정과 같아졌는지 알려 준다. */
  const flush = useCallback(async () => {
    if (!supabase || !userId) return false;
    const token = boundary.token();
    if (!token) return false;
    await settled(running);
    if (running.current || !boundary.current(token)) return false;
    await sync();
    await settled(running);
    if (running.current || !boundary.current(token)) return false;
    const state = parseSyncState(await syncStateStore.load());
    return boundary.current(token) && !!data.current && isBackedUp(userId, data.current, state);
  }, [sync, userId]);

  /** 로그아웃하고 이 기기의 수첩을 지운다. 같은 기기를 다음에 쓰는 사람에게 남지 않고, 다른 계정에 섞여 올라가지 않는다. */
  const signOutAndClear = useCallback(async () => {
    setReady(false);
    stopped.current = true;
    signingOut.current = true;
    boundary.stop();
    again.current = false;
    let authSignedOut = false;
    try {
      await signOutThenClear({
        signOut: async () => { await signOut(); authSignedOut = true; },
        localSignOut: async () => {
          const result = await supabase?.auth.signOut({ scope: "local" });
          if (result?.error) throw result.error;
          authSignedOut = true;
        },
        // 인증 해제 뒤에도 먼저 수첩 저장을 끝낸다. 저장 실패면 사진은 남긴다.
        clearNotebook: () => boundary.clear(async () => {
          await commit.current(() => emptyNotebook());
          await todayStore.clear();
          await syncStateStore.clear();
          await placeCacheStore.clear().catch(() => undefined);
          forgetCandidates();
        }),
        clearPhotos: () => { clearVoiceFiles(); clearHeroPhotos(); clearDayPhotos(); },
      });
      await notebookOwnerStore.clear();
    } catch (error) {
      // 인증은 이미 풀렸을 수 있으므로 수첩 정리 실패를 현재 화면과 별도로 알린다.
      Alert.alert(tr.current("account.signOutFailed"), tr.current("common.tryLater"));
      if (!authSignedOut) {
        if (session?.user.id) boundary.activate(session.user.id);
        stopped.current = false;
      }
      throw error;
    } finally {
      signingOut.current = false;
      setReady(true);
    }
  }, [session]);

  /** 다른 계정으로 전환할 때 이전 계정의 기기 수첩을 먼저 정리한다. */
  const clearPreviousAndContinue = useCallback(async () => {
    if (!session || !pendingSwitch) return;
    const nextUserId = session.user.id;
    await boundary.clear(async () => {
      await commit.current(() => emptyNotebook());
      await syncStateStore.clear();
      await todayStore.clear();
      await placeCacheStore.clear().catch(() => undefined);
      clearVoiceFiles(); clearHeroPhotos();
      clearDayPhotos();
      forgetCandidates();
      await notebookOwnerStore.save(nextUserId);
    });
    boundary.activate(nextUserId);
    stopped.current = false;
    setPendingSwitch(false);
  }, [session, pendingSwitch]);

  const keepPreviousAndSignOut = useCallback(async () => {
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
  }, []);

  return {
    enabled: !!supabase,
    ready,
    session,
    email: session?.user.email ?? null,
    provider: (session?.user.app_metadata?.provider as string | undefined) ?? null,
    premium,
    status,
    syncedAt,
    conflict,
    conflictChanged,
    pendingSwitch,
    sync,
    flush,
    signOutAndClear,
    clearPreviousAndContinue,
    keepPreviousAndSignOut,
    resolveConflict,
    /**
     * 로그아웃·계정 삭제 뒤 다른 계정과 섞이지 않게 동기화 기록을 지운다. 수첩은 기기에 남는다.
     * 계정을 지웠으면 releaseOwner로 소유자도 지운다. 남기면 새 계정마다 전환 화면이 떠 남긴 수첩을 지우라고 한다.
     */
    forget: (options?: { releaseOwner?: boolean }) => {
      boundary.stop();
      return boundary.clear(async () => {
        await syncStateStore.clear();
        if (options?.releaseOwner) await notebookOwnerStore.clear();
      });
    },
  };
}

/** 돌고 있는 동기화가 끝나길 최대 4초 기다린다. */
async function settled(running: { current: boolean }) {
  for (let i = 0; i < 40 && running.current; i++) await new Promise((resolve) => setTimeout(resolve, 100));
}
