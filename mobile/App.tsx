import { recordSettlementPayment } from "./src/data/settlementView";
import { deleteTripMemories,writeMemory } from "./src/data/diaryMemoryStore";
import { useTabSlide } from "./src/hooks/useTabSlide";
import { usePassport } from "./src/data/usePassport";
import { stampCountry } from "./src/data/stampCountries";
import { PicksPage } from "./src/screens/PicksPage";
import type { PlanView } from "./src/screens/PlanPage";
import type { MoneyView } from "./src/screens/BudgetPage";
import { sampleTrips } from "./src/data/devSample";
import { File,Paths } from "expo-file-system";
import { TravelPouch,type PouchEntry } from "./src/screens/TravelPouch";
import { BookingAutofillCard } from "./src/components/BookingAutofill";
import { applySuggestions,type Suggestion } from "./src/data/bookingAutofill";
import { useEffect,useMemo,useRef,useState } from "react";
import {
AccessibilityInfo,
ActivityIndicator,
Animated,
Alert,
BackHandler,
Linking,
KeyboardAvoidingView,
Modal,
Platform,
Pressable,
Text,
View,
} from "react-native";
import { SafeAreaProvider,SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { I18nProvider,useI18n } from "./src/i18n/I18n";
import { KeyedError } from "./src/i18n/errors";
import { BottomNav,IconButton,TopBar } from "./src/theme/mono";
import { LaunchCurtain } from "./src/components/LaunchCurtain";
import { Settle } from "./src/components/Motion";
import { diary,mono,radius,space,textRole } from "./src/theme/tokens";
import { SettingsScreen } from "./src/screens/Settings";
import { ConsentSheet,LegalProvider,useLegal } from "./src/legal/Legal";
import { GUEST } from "./src/data/consent";
import { signOut } from "./src/data/auth";
import { supabase } from "./src/data/supabase";
import { randomUUID } from "expo-crypto";
import {
addTrip,
selectTrip,
setTripArchived,
} from "../src/domain/workspace/library";
import type { TripExpense,TripWorkspace } from "../src/domain/workspace/types";
import type { Reservation } from "../src/domain/reservations/types";
import { zonedDate } from "../src/domain/time/zoned";
import { notebookDay } from "./src/data/notebookView";
import { afterReservationSave } from "./src/data/bookingEntryFlow";
import { useNotebook } from "./src/data/useNotebook";
import { useAccount } from "./src/data/useAccount";
import { BudgetSplit } from "./src/screens/BudgetSplit";
import { WelcomeScreen } from "./src/screens/Welcome";
import { modeStore,premiumStore,welcomeStore } from "./src/data/sqlite";
import { NotebookMenu,type NotebookMenuAction } from "./src/screens/NotebookMenu";
import { noPremium,type PremiumSettings } from "./src/data/premium";
import type { NotebookData,PageEntry,PageKind } from "./src/data/model";
import { exportNotebook,pickNotebook } from "./src/data/backup";
import { deleteTripFiles,sweepOrphanPhotos } from "./src/data/photoFiles";
import { deleteNotebook,stickerPhotoFiles,touchNotebookTrip } from "./src/data/notebookDelete";
import {
Button,
Caption,
colors,
s,
Sheet,
Title,
} from "./src/components/ui";
import { NotebookSettings } from "./src/screens/NotebookSettings";
import { CreateNotebook } from "./src/screens/CreateNotebook";
import {
newReservation,
ReservationDetails,
ReservationForm,
} from "./src/screens/Reservations";
import { PageEditor } from "./src/screens/PageEditor";
import { PackingList } from "./src/screens/PackingList";
import { PageDetail } from "./src/screens/PageDetail";
import { ExpenseEditor,type ExpenseDraft } from "./src/screens/ExpenseEditor";
import { LibraryScreen } from "./src/screens/Library";
import {
NotebookPages,
tabs,
type Tab,
} from "./src/screens/NotebookPages";

type Panel =
  | { kind: "reservation"; item: Reservation }
  | { kind: "reservation-edit"; item: Reservation; from?: "overview" }
  | { kind: "page"; item: PageEntry }
  | { kind: "page-edit"; item: PageEntry }
  | { kind: "expense"; item?: TripExpense; draft?: ExpenseDraft }
  | { kind: "budget" }
  | { kind: "packing" }
  | { kind: "settings" }
  | { kind: "picks" }
  | null;
export default function App() {
  // 글자는 시스템 산세리프 하나만 쓴다. 따로 불러올 글꼴이 없다.
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <I18nProvider>
        <LegalProvider>
          <NotebookApp />
        </LegalProvider>
      </I18nProvider>
      <LaunchCurtain />
    </SafeAreaProvider>
  );
}
function NotebookApp() {
  const { t, lang } = useI18n();
  const store = useNotebook();
  const account = useAccount(store);
  const legal = useLegal();
  const forgetConsent = legal.forgetAccount;
  // 첫 화면(로그인) 표시 여부. null이면 아직 확인 중.
  const [welcomeSkipped, setWelcomeSkipped] = useState<boolean | null>(null);
  useEffect(() => {
    welcomeStore.skipped().then(setWelcomeSkipped, () => setWelcomeSkipped(true));
  }, []);
  // 로그인하면 첫 화면을 넘긴 것으로 기록하고, 로그아웃하면 지워 다시 첫 화면을 보인다.
  // 계정 동의와 기능 동의도 지워서 다음 로그인(다른 사람일 수 있다) 때 다시 받는다.
  const signedIn = !!account.session;
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (wasSignedIn.current && !signedIn) {
      setWelcomeSkipped(false);
      void welcomeStore.reset().catch(() => undefined);
      forgetConsent();
    }
    wasSignedIn.current = signedIn;
  }, [signedIn, forgetConsent]);
  // 로그인 전에 받은 동의를 그 계정의 서버 기록으로 남긴다. 실패하면 다음 실행 때 다시 올린다.
  const userId = account.session?.user.id;
  const { ready: consentReady, send: sendConsent, state: consentState, setOwner: setConsentOwner } = legal;
  // AI·장소 기능 동의는 동의한 사람에게만 효력이 있다. 계정이 바뀌면 다시 묻는다.
  useEffect(() => {
    setConsentOwner(userId ?? GUEST);
  }, [userId, setConsentOwner]);
  useEffect(() => {
    if (!supabase || !userId || !consentReady) return;
    const client = supabase;
    void sendConsent((rows) => client.from("consents").insert(rows), userId);
  }, [userId, consentReady, consentState, sendConsent]);
  // 로그인했는데 지금 판의 동의 기록이 없으면(약관이 바뀌었거나 동의 화면 전에 로그인한 경우) 다시 받는다.
  const needsConsent = account.enabled && signedIn && consentReady && !legal.accountValid;
  async function refuseConsent() {
    // 서버에 닿지 않아도 이 기기의 로그인은 지운다.
    await signOut().catch(() => supabase?.auth.signOut({ scope: "local" }));
    await account.forget().catch(() => undefined);
  }
  const pouchDestination = useRef<Panel>(null);
  function finishPouchTransition() {
    const next=pouchDestination.current;
    pouchDestination.current=null;
    if(next) setPanel(next);
  }
  function openFromPouch(next:Panel) {
    pouchDestination.current=next;
    setPouchOpen(false);
    if(Platform.OS !== "ios") finishPouchTransition();
  }
  const [screen, setScreen] = useState<
      "library" | "create" | "trip" | "settings"
    >("library"),
    [pouchOpen,setPouchOpen]=useState(false),
    [tab, setTab] = useState<Tab>("plan"),
    [panel, setPanel] = useState<Panel>(null),
    [backupBusy, setBackupBusy] = useState(false),
    [settingsDirty, setSettingsDirty] = useState(false),
    [now, setNow] = useState(new Date()),
    [savedPremium, setPremium] = useState<PremiumSettings>(noPremium),
    // JEV에게 묻고 적은 줄. 앱을 켜 둔 동안 여행별로만 남긴다.
    [pouchLog, setPouchLog] = useState<Record<string, PouchEntry[]>>({}),
    [menu, setMenu] = useState<"main" | null>(null),
    // 계획의 네 보기가 함께 쓰는 고른 날짜. 여행마다 따로 기억한다.
    [planDates, setPlanDates] = useState<Record<string, string>>({}),
    [planView, setPlanView] = useState<PlanView>("times"),
    [moneyView, setMoneyView] = useState<MoneyView>("expenses"),
    // 저장한 뒤 화면 위에 잠깐 띄우는 한 줄(예약 저장, 여권 도장).
    [note, setNote] = useState<string | null>(null);
  const menuAction = useRef<(() => void) | null>(null);
  const tabSlide=useTabSlide<Tab>(tab,setTab,screen === "trip",tabs.map((x) => x.key));
  // 로그인했으면 계정의 유료 권한과 로그인 토큰을 붙인다. 이 둘은 기기에 저장하지 않는다.
  const premium: PremiumSettings = account.session
    ? { ...savedPremium, member: { token: account.session.access_token, premium: account.premium } }
    : savedPremium;
  useEffect(() => {
    premiumStore.load().then(setPremium, () => setPremium(noPremium));
  }, []);
  function changePremium({ member: _member, ...next }: PremiumSettings) {
    setPremium(next);
    premiumStore.save(next).catch(() => undefined);
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  // 수첩을 처음 읽은 뒤 한 번, 사라진 수첩(백업 복원·다른 기기 동기화)의 사진과 남은 사진 파일을 정리한다.
  // 첫 읽기가 실패하면 이번 실행에서는 정리하지 않는다. 그 뒤 백업 복원으로 생긴 data를 기준으로 지우면
  // 디스크에만 남은 수첩의 사진이 사라진다. 같은 실행 중에 복원을 되돌려도 사진이 남도록 시작 때만 한다.
  // 링크로 여행 탭 열기: escale://trip?tab=today&view=calendar (예전 margin:// 링크도 같다).
  // 개발 빌드에서는 escale://dev/sample 이 예시 여행을 넣는다(화면 점검·캡처용).
  const openLink = useRef<(url: string) => void>(() => undefined);
  openLink.current = (url: string) => {
    const match = /^[a-z]+:\/\/([a-z]+)(?:\/([a-z]+))?\/?(?:\?(.*))?$/.exec(url);
    if (!match || !store.data) return;
    const [, host, path, query] = match;
    const params = new URLSearchParams(query ?? "");
    if (__DEV__ && host === "dev" && path === "sample") {
      const sample = sampleTrips(new Date());
      const ids = new Set(sample.trips.map((x) => x.id));
      safe(async () => {
        await store.commit((data) => ({
          ...data,
          library: { ...data.library, activeTripId: sample.trips[0].id, updatedAt: new Date().toISOString(), trips: [...sample.trips, ...data.library.trips.filter((x) => !ids.has(x.id))] },
          pages: [...data.pages.filter((p) => !ids.has(p.tripId)), ...sample.pages],
        }));
        setScreen("trip");
        setTab("today");
      });
      return;
    }
    if (host !== "trip") return;
    const id = params.get("id");
    const target = id ? store.data.library.trips.find((x) => x.id === id) : trip ?? store.data.library.trips[0];
    if (!target) return;
    const next = tabs.find((x) => x.key === params.get("tab"))?.key ?? "plan";
    const view = params.get("view");
    if (view === "times" || view === "calendar" || view === "map" || view === "bookings") setPlanView(view);
    if (view === "expenses" || view === "settle") setMoneyView(view);
    setPanel(null);
    setPouchOpen(params.get("jev") === "1");
    safe(async () => {
      if (store.data?.library.activeTripId !== target.id) await store.commit((data) => ({ ...data, library: selectTrip(data.library, target.id, new Date().toISOString()) }));
      setScreen("trip");
      setTab(next);
    });
  };
  const loaded = !store.loading && !!store.data;
  useEffect(() => {
    if (!loaded) return;
    void Linking.getInitialURL().then((url) => url && openLink.current(url));
    // 개발 빌드: 시뮬레이터에서 확인 창 없이 링크를 열도록 Documents/dev-open.txt를 한 번 읽고 지운다.
    if (__DEV__) {
      try {
        const file = new File(Paths.document, "dev-open.txt");
        if (file.exists) {
          const lines = file.textSync().split("\n").map((x) => x.trim()).filter(Boolean);
          file.delete();
          lines.forEach((url, i) => setTimeout(() => openLink.current(url), i * 800));
        }
      } catch {
        // 개발 도구라 실패해도 앱은 그대로 연다.
      }
    }
    const sub = Linking.addEventListener("url", ({ url }) => openLink.current(url));
    return () => sub.remove();
  }, [loaded]);
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current || store.loading) return;
    swept.current = true;
    if (store.data) void sweepOrphanPhotos(store.data.library.trips.map((trip) => trip.id));
  }, [store.loading, store.data]);
  const trip = store.data?.library.trips.find(
    (t) => t.id === store.data?.library.activeTripId,
  );
  const tripId = trip?.id;
  // 자주 쓰는 지출을 찾을 때 함께 보는 이 기기의 다른 수첩 지출. 계산은 기기 안에서만 한다.
  const libraryTrips = store.data?.library.trips;
  const otherExpenses = useMemo(() => (libraryTrips ?? []).filter((t) => t.id !== tripId).flatMap((t) => t.ledger.expenses), [libraryTrips, tripId]);
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);
  // 여권: 귀국일이 된 여행에 그 나라 도장을 한 번 찍는다. 새로 찍히면 한 줄로 알린다.
  const passport = usePassport(libraryTrips, now, lang);
  const { issued: newStamps, clearIssued } = passport;
  useEffect(() => {
    if (!newStamps.length) return;
    const country = stampCountry(newStamps[0].country);
    const name = country ? (lang === "ja" ? country.name.ja : lang === "ko" ? country.name.ko : country.name.en) : newStamps[0].country;
    showNote(t("passport2.issued", { country: name }));
    clearIssued();
    // 도장이 새로 찍힐 때만 알린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newStamps]);
  function showNote(text: string) {
    setNote(text);
    AccessibilityInfo.announceForAccessibility(text);
  }
  function dismiss() {
    if (store.saving) return;
    if (
      panel &&
      (["reservation-edit", "page-edit", "expense", "budget"].includes(panel.kind) || (panel.kind === "settings" && settingsDirty))
    )
      Alert.alert(t("app.discardTitle"), t("app.discardBody"), [
        { text: t("app.keepEditing"), style: "cancel" },
        { text: t("common.close"), style: "destructive", onPress: () => setPanel(null) },
      ]);
    else setPanel(null);
  }
  function navigateTab(next:Tab) {
    tabSlide.slide(next);
  }
  function back() {
    if (menu) { setMenu(null); return; }
    if(pouchOpen){setPouchOpen(false);return;}
    if (panel) {
      dismiss();
      return;
    }
    if (screen === "create") {
      Alert.alert(
        t("app.discardCreate"),
        t("app.discardBody"),
        [
          { text: t("app.keepEditing"), style: "cancel" },
          {
            text: t("common.close"),
            style: "destructive",
            onPress: () => setScreen("library"),
          },
        ],
      );
      return;
    }
    setScreen("library");
  }
  useEffect(() => {
    const l = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "library" && !panel) return false;
      back();
      return true;
    });
    return () => l.remove();
  });
  async function changeTrip(update: (trip: TripWorkspace) => TripWorkspace) {
    if (!trip) return;
    const id = trip.id;
    await store.commit((data) => ({
      ...data,
      library: {
        ...data.library,
        updatedAt: new Date().toISOString(),
        trips: data.library.trips.map((t) =>
          t.id === id
            ? { ...update(t), updatedAt: new Date().toISOString() }
            : t,
        ),
      },
    }));
  }
  /** 오늘 날짜로 기록 한 줄. 오늘 탭의 한 줄과 여행 도구가 함께 쓴다. */
  async function addJournal(text: string) {
    if (!trip) return;
    const tripId = trip.id, date = zonedDate(new Date(), trip.settings.timeZone);
    await changePages((pages) => [...pages, { id: randomUUID(), tripId, kind: "journal", title: text.slice(0, 120), date, body: "", address: "", done: false }]);
  }
  // 속지·준비물·스티커 변경도 수첩 수정 시각에 반영해 삭제 충돌에서 새 편집을 알아본다.
  async function commitTripContent(update: (data: NotebookData) => NotebookData) {
    const tripId = trip?.id;
    await store.commit((data) => {
      const next = update(data);
      return tripId ? touchNotebookTrip(next, tripId, new Date()) : next;
    });
  }
  async function changePages(update: (pages: PageEntry[]) => PageEntry[]) {
    await commitTripContent((data) => ({ ...data, pages: update(data.pages) }));
  }
  const safe = (action: () => Promise<void>) => {
    void action().catch(() =>
      Alert.alert(t("app.saveFailed"), t("app.saveFailedBody")),
    );
  };
  /** 되돌릴 수 없으므로 수첩 이름을 보여 주고 한 번 더 묻는다. 수첩을 먼저 저장한 뒤 사진·기기 설정을 지운다. */
  function confirmDelete(target: TripWorkspace) {
    const id = target.id;
    Alert.alert(t("app.deleteTitle", { title: target.settings.title }), t("app.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("app.delete"),
        style: "destructive",
        onPress: () =>
          safe(async () => {
            let files: string[] = [];
            await store.commit((data) => {
              files = stickerPhotoFiles(data, id);
              return deleteNotebook(data, id, new Date());
            });
            setSettingsDirty(false);
            setPanel(null);
            setScreen("library");
            // 예전 여행 방식 설정이 남아 있으면 함께 지운다.
            await modeStore.forgetTrip(id).catch(() => undefined);
            await deleteTripFiles(id, files);
            await deleteTripMemories(id).catch(() => undefined);
          }),
      },
    ]);
  }
  async function restore() {
    setBackupBusy(true);
    try {
      const data = await pickNotebook();
      if (data)
        Alert.alert(
          t("app.replaceTitle"),
          t("app.replaceBody", { n: data.library.trips.length }),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("app.import"),
              onPress: () =>
                safe(async () => {
                  const { diaryMemories, ...notebook } = data;
                  for (const memory of diaryMemories ?? []) await writeMemory(memory);
                  await store.commit(() => notebook, notebook);
                  setPanel(null);
                  setScreen("library");
                }),
            },
          ],
        );
    } catch (e) {
      Alert.alert(
        t("app.importFailed"),
        e instanceof KeyedError ? t(e.key) : e instanceof Error ? e.message : t("app.checkFile"),
      );
    } finally {
      setBackupBusy(false);
    }
  }
  async function backup() {
    if (!store.data) return;
    setBackupBusy(true);
    try {
      await exportNotebook(store.data);
    } catch (e) {
      Alert.alert(
        t("app.backupFailed"),
        e instanceof KeyedError ? t(e.key) : e instanceof Error ? e.message : t("app.checkSave"),
      );
    } finally {
      setBackupBusy(false);
    }
  }
  function newPage(kind: PageKind, preset?: { date: string; time?: string }) {
    if (trip)
      setPanel({
        kind: "page-edit",
        item: {
          id: randomUUID(),
          tripId: trip.id,
          kind,
          title: "",
          date:
            preset?.date ??
            (kind === "plan"
              ? notebookDay(trip.settings,now).date
              : zonedDate(now, trip.settings.timeZone)),
          body: "",
          address: "",
          done: false,
          ...(preset?.time ? { time: preset.time } : {}),
        },
      });
  }
  // 여행 안의 윗줄: 여행 목록으로, 여행 이름, 메뉴. JEV는 아래 탭 가운데 돛 버튼으로 연다.
  const header = trip && (
    <TopBar
      left={<IconButton icon="back" label={t("trip.toList")} disabled={store.saving} onPress={back} />}
      center={<Text numberOfLines={1} style={[textRole.control, { color: mono.ink }]}>{trip.settings.title}</Text>}
      right={
        store.saving ? (
          <ActivityIndicator color={mono.ink} />
        ) : (
          <IconButton icon="menu" label={t("trip.menu")} onPress={() => setMenu("main")} />
        )
      }
    />
  );
  function closeMenu(action?: () => void) {
    menuAction.current = Platform.OS === "ios" ? action ?? null : null;
    setMenu(null);
    if (Platform.OS !== "ios") action?.();
  }
  function finishMenuTransition() {
    const action = menuAction.current;
    menuAction.current = null;
    action?.();
  }
  function selectMenuAction(action: NotebookMenuAction) {
    if (!trip) return;
    if (action === "settings") closeMenu(() => { setSettingsDirty(false); setPanel({ kind: "settings" }); });
    else if (action === "archive") closeMenu(() => safe(() => store.commit((data) => ({ ...data, library: setTripArchived(data.library, trip.id, !trip.settings.archived, new Date().toISOString()) }))));
    else if (action === "delete") closeMenu(() => confirmDelete(trip));
  }
  let content;
  if (store.loading)
    content = (
      <View style={[s.empty, { flex: 1, alignItems: "center" }]}>
        <ActivityIndicator />
        <Caption>{t("app.loading")}</Caption>
      </View>
    );
  else if (!store.data && screen !== "settings")
    content = (
      <Sheet>
        <Title>{t("app.loadFailed")}</Title>
        <Caption>{t("app.loadFailedBody")}</Caption>
        <Button title={t("app.reload")} onPress={() => void store.load()} />
        <Button
          title={t("app.restore")}
          quiet
          onPress={() => setScreen("settings")}
        />
      </Sheet>
    );
  else if (screen === "create")
    content = (
      <CreateNotebook
        onCancel={back}
        saving={store.saving}
        onCreate={async (value) => {
          await store.commit((data) => ({
            ...data,
            library: addTrip(data.library, value),
          }));
          setTab("plan");
          setScreen("trip");
        }}
      />
    );
  else if (screen === "settings")
    content = (
      <SettingsScreen
        account={account}
        saving={store.saving}
        busy={backupBusy}
        canExport={!!store.data}
        onBack={() => setScreen("library")}
        onExport={() => void backup()}
        onImport={() => void restore()}
      />
    );
  else if (screen === "library" || !trip)
    content = (
      <LibraryScreen
        library={store.data!.library}
        saving={store.saving}
        now={now}
        onSettings={() => setScreen("settings")}
        // 백업이 잘 되는 중이면 아래 줄을 비우고, 확인이 필요할 때만 알린다.
        accountLabel={!account.enabled ? t("app.accountBackup") : account.session && account.status === "conflict" ? t("app.accountConflict") : undefined}
        // 로그인 없이 둘러보는 중이면 맛보기 띠에서 로그인 화면으로 돌아간다.
        onSignIn={account.enabled && !account.session ? () => setWelcomeSkipped(false) : undefined}
        onCreate={() => setScreen("create")}
        onOpen={(id) =>
          safe(async () => {
            await store.commit((data) => ({
              ...data,
              library: selectTrip(data.library, id, new Date().toISOString()),
            }));
            setScreen("trip");
            setTab("plan");
          })
        }
      />
    );
  else
    content = (
      <NotebookPages
        trip={trip}
        trips={store.data!.library.trips}
        pages={store.data!.pages.filter((p) => p.tripId === trip.id)}
        tab={tab}
        now={now}
        setTab={navigateTab}
        planDate={planDates[trip.id]}
        setPlanDate={(date) => setPlanDates((all) => ({ ...all, [trip.id]: date }))}
        planView={planView}
        setPlanView={setPlanView}
        moneyView={moneyView}
        setMoneyView={setMoneyView}
        passport={passport.state}
        passportReady={passport.ready}
        passportLoadError={passport.loadError}
        retryPassport={passport.retryLoad}
        passportSaveError={passport.saveError}
        retryPassportSave={passport.retrySave}
        setTripCancelled={passport.setCancelled}
        setTripCompleted={passport.setCompleted}
        newPage={newPage}
        openPage={(item) => setPanel({ kind: "page", item })}
        openReservation={(item) => setPanel({ kind: "reservation", item })}
        onAddReservation={(date) => setPanel({ kind: "reservation-edit", item: newReservation(trip.settings.timeZone, date ?? trip.settings.startDate), from: "overview" })}
        openPicks={() => setPanel({ kind: "picks" })}
        changePage={(id, done) => changePages((pages) => pages.map((p) => (p.id === id ? { ...p, done } : p)))}
        expense={(id) =>
          setPanel({
            kind: "expense",
            item: trip.ledger.expenses.find((e) => e.id === id),
          })
        }
        expenseDraft={(draft) => setPanel({ kind: "expense", draft })}
        budget={() => setPanel({ kind: "budget" })}
        openMembers={() => { setSettingsDirty(false); setPanel({ kind: "settings" }); }}
        recordPayment={(transfer) => changeTrip((t) => recordSettlementPayment(t, transfer, randomUUID(), new Date().toISOString()))}
        removePayment={(id) => changeTrip((t) => ({ ...t, ledger: { ...t.ledger, payments: t.ledger.payments.filter((p) => p.id !== id) } }))}
        packing={(store.data!.packing ?? []).filter((i) => i.tripId === trip.id)}
        openPacking={() => setPanel({kind:"packing"})}
        applyAutofill={applyAutofill}
        saving={store.saving}
        // 서재의 맛보기 띠와 같은 로그인 화면으로 간다. 로그인 뒤에는 보던 여행으로 돌아온다.
        onSignIn={account.enabled && !account.session ? () => setWelcomeSkipped(false) : undefined}
      />
    );
  // 예약에서 일정 채우기: 고른 줄만 계획에 넣거나 시각을 고친다. 같은 id가 있으면 새로 붙이지 않는다.
  async function applyAutofill(chosen: Suggestion[]) {
    if (!trip) return;
    const tripId = trip.id;
    await changePages((pages) => applySuggestions(pages, chosen, tripId));
  }
  async function saveReservation(item: Reservation) {
    await changeTrip((t) => ({
      ...t,
      reservations: t.reservations?.some((r) => r.id === item.id)
        ? t.reservations.map((r) => (r.id === item.id ? item : r))
        : [...(t.reservations ?? []), item],
    }));
    finishReservationSave(item);
  }
  function finishReservationSave(saved: Reservation) {
    const next = afterReservationSave(panel, saved);
    setPanel(next.panel);
    if (next.note) showNote(t(next.note));
  }
  // 왕복 사진처럼 여러 구간을 한 번의 저장으로 넣는다. 개요에서 시작하지 않았으면 첫 구간 상세를 연다.
  async function saveReservations(items: Reservation[]) {
    const ids = new Set(items.map((r) => r.id));
    await changeTrip((t) => ({
      ...t,
      reservations: [...(t.reservations ?? []).filter((r) => !ids.has(r.id)), ...items],
    }));
    finishReservationSave(items[0]);
  }
  const activeReservation =
    panel?.kind === "reservation"
      ? (trip?.reservations ?? []).find((r) => r.id === panel.item.id)
      : undefined;
  if (account.enabled && (!account.ready || welcomeSkipped === null))
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  if (account.pendingSwitch)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, justifyContent: "center", padding: 24, gap: 16 }}>
        <Title>{t("account.previousTitle")}</Title>
        <Caption>{t("account.previousBody")}</Caption>
        <Button title={t("account.clearPrevious")} disabled={store.loading || store.saving} onPress={() => void account.clearPreviousAndContinue().catch(() => Alert.alert(t("app.saveFailed"), t("common.tryLater")))} />
        <Button quiet title={t("account.keepPrevious")} onPress={() => void account.keepPreviousAndSignOut().catch(() => Alert.alert(t("account.signOutFailed"), t("common.tryLater")))} />
      </SafeAreaView>
    );
  if (account.enabled && !account.session && !welcomeSkipped)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["bottom"]}>
        <WelcomeScreen
          onSkip={() => {
            setWelcomeSkipped(true);
            void welcomeStore.skip().catch(() => undefined);
          }}
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: screen === "trip" ? diary.page : diary.paper }}
      edges={["top", "bottom"]}
    >
      <ConsentSheet visible={needsConsent} mode="renew" onAgree={legal.agreeAccount} onCancel={() => void refuseConsent()} />
      <NotebookMenu open={!!menu} title={trip?.settings.title ?? ""} archived={!!trip?.settings.archived} onBack={back} onSelect={selectMenuAction} onDismiss={finishMenuTransition} />
      {screen === "trip" && header}
      {note && (
        <Text accessibilityLiveRegion="polite" style={[textRole.meta, { color: mono.accentText, fontWeight: "600", marginHorizontal: space.gutter, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.control, backgroundColor: mono.accentSoft }]}>
          {note}
        </Text>
      )}
      {store.error ? (
        <Text accessibilityRole="alert" style={[s.error, { padding: 16 }]}>
          {t(store.error)}
        </Text>
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {screen === "trip" ? <View style={{flex:1,overflow:"hidden"}}><Animated.View pointerEvents={tabSlide.sliding ? "none" : "auto"} accessibilityElementsHidden={tabSlide.sliding} importantForAccessibility={tabSlide.sliding ? "no-hide-descendants" : "auto"} style={[{flex:1},tabSlide.style]}>
          {content}
        </Animated.View></View> : content}
      </KeyboardAvoidingView>
      {screen === "trip" && trip && (
        <BottomNav
          items={tabs.map((x) => ({ key: x.key, title: t(x.title), icon: x.icon }))}
          active={tab}
          onSelect={navigateTab}
          label={t("nav.trip")}
          disabled={store.saving}
          center={{ label: t("nav.tools"), title: t("nav.tools"), hint: t("nav.toolsHint"), onPress: () => setPouchOpen(true), onLongPress: () => setPanel({ kind: "expense" }) }}
        />
      )}
      <Modal visible={pouchOpen} onDismiss={finishPouchTransition} transparent animationType="fade" onRequestClose={()=>{if(!store.saving)setPouchOpen(false);}}>
        <SafeAreaProvider><View style={{flex:1,backgroundColor:mono.scrim,justifyContent:"flex-end"}}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("kit.close")} disabled={store.saving} onPress={()=>setPouchOpen(false)} style={{flex:1}} />
          {/* 막은 번지고 여행 도구 쪽은 아래에서 종이처럼 올라온다. 막째로 미끄러지던 기본 슬라이드를 대신한다. */}
          <Settle from={64} style={{height:"94%"}}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex:1}}>
          <View style={{flex:1,backgroundColor:diary.page}}>
            {trip && <TravelPouch
              premium={premium}
              trip={trip}
              items={(store.data?.packing ?? []).filter(i=>i.tripId===trip.id)}
              pages={(store.data?.pages ?? []).filter(p=>p.tripId===trip.id)}
              now={now}
              saving={store.saving}
              log={pouchLog[trip.id] ?? []}
              setLog={change=>setPouchLog(all=>({...all,[trip.id]:change(all[trip.id] ?? [])}))}
              onClose={()=>setPouchOpen(false)}
              onPacking={()=>openFromPouch({kind:"packing"})}
              onReservation={item=>openFromPouch({kind:"reservation",item})}
              onAddReservation={()=>openFromPouch({kind:"reservation-edit",item:newReservation(trip.settings.timeZone,trip.settings.startDate)})}
              onOpenPage={item=>openFromPouch({kind:"page",item})}
              onAddItem={async (title,done)=>{const id=randomUUID();await commitTripContent(data=>({...data,packing:[...(data.packing ?? []),{id,tripId:trip.id,title,done}]}));return id;}}
              onSetDone={async (id,done)=>{await commitTripContent(data=>({...data,packing:(data.packing ?? []).map(i=>i.id===id ? {...i,done} : i)}));}}
              onRemove={async id=>{await commitTripContent(data=>({...data,packing:(data.packing ?? []).filter(i=>i.id!==id)}));}}
              onAddExpense={expense=>changeTrip(t=>({...t,ledger:{...t.ledger,expenses:[...t.ledger.expenses,expense]}}))}
              onRemoveExpense={id=>changeTrip(t=>({...t,ledger:{...t.ledger,expenses:t.ledger.expenses.filter(e=>e.id!==id)}}))}
              onEditExpense={item=>openFromPouch({kind:"expense",item})}
              onExpenseDraft={draft=>openFromPouch({kind:"expense",draft})}
              onJournal={addJournal}
            />}
          </View></KeyboardAvoidingView>
          </Settle>
        </View></SafeAreaProvider>
      </Modal>
      <Modal
        visible={!!panel}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={dismiss}
      >
        <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: trip ? diary.page : diary.paper }}>
          {!(panel?.kind === "page-edit" && panel.item.kind === "journal") && <TopBar
            left={<IconButton icon="back" label={t("common.back")} disabled={store.saving} onPress={dismiss} />}
            right={store.saving ? <ActivityIndicator color={mono.ink} /> : panel?.kind === "page" && panel.item.kind === "journal" ? <IconButton finish="silver" icon="pen" label={t("common.edit")} onPress={() => setPanel({ kind: "page-edit", item: panel.item })} /> : undefined}
          />}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {panel?.kind === "packing" && trip && <PackingList items={(store.data?.packing??[]).filter(i=>i.tripId===trip.id)} saving={store.saving} onToggle={async(id,done)=>{await commitTripContent(data=>({...data,packing:(data.packing??[]).map(i=>i.id===id?{...i,done}:i)}));}} onAdd={async title=>{await commitTripContent(data=>({...data,packing:[...(data.packing??[]),{id:randomUUID(),tripId:trip.id,title,done:false}]}));}} onRemove={async id=>{await commitTripContent(data=>({...data,packing:(data.packing??[]).filter(i=>i.id!==id)}));}} onRename={async(item,title)=>{await commitTripContent(data=>({...data,packing:(data.packing??[]).map(i=>i.id===item.id?{...i,title}:i)}));}}/>}
            {panel?.kind === "picks" && trip && <PicksPage key={trip.id} trip={trip} pages={(store.data?.pages ?? []).filter((p) => p.tripId === trip.id)} now={now} onAdd={(entries) => changePages((pages) => [...pages, ...entries])} />}
            {panel?.kind === "settings" && trip && <NotebookSettings trip={trip} saving={store.saving} onDirtyChange={setSettingsDirty} onDelete={()=>confirmDelete(trip)} onSave={async updated=>{await store.commit(data=>({...data, library:{...data.library,updatedAt:new Date().toISOString(),trips:data.library.trips.map(t=>t.id===trip.id ? updated : t)}}));setSettingsDirty(false);setPanel(null);}} />}
            {panel?.kind === "reservation-edit" && (
              <ReservationForm
                existing={trip?.reservations ?? []}
                key={panel.item.id}
                initial={panel.item}
                premium={premium}
                onPremiumChange={changePremium}
                saving={store.saving}
                onCancel={dismiss}
                onSave={saveReservation}
                onSaveMany={saveReservations}
              />
            )}
            {activeReservation && (
              <ReservationDetails
                item={activeReservation}
                saving={store.saving}
                autofill={trip && (activeReservation.kind === "stay" || activeReservation.kind === "flight") ? (
                  <BookingAutofillCard
                    trip={trip}
                    pages={(store.data?.pages ?? []).filter((p) => p.tripId === trip.id)}
                    reservationId={activeReservation.id}
                    saving={store.saving}
                    onApply={applyAutofill}
                  />
                ) : undefined}
                onEdit={() =>
                  setPanel({
                    kind: "reservation-edit",
                    item: activeReservation,
                  })
                }
                onVerify={() =>
                  safe(() =>
                    changeTrip((t) => ({
                      ...t,
                      reservations: t.reservations?.map((r) =>
                        r.id === activeReservation.id
                          ? { ...r, verifiedAt: new Date().toISOString() }
                          : r,
                      ),
                    })),
                  )
                }
                onRemove={() =>
                  safe(async () => {
                    await changeTrip((t) => ({
                      ...t,
                      reservations: t.reservations?.filter(
                        (r) => r.id !== activeReservation.id,
                      ),
                    }));
                    setPanel(null);
                  })
                }
              />
            )}
            {panel?.kind === "page-edit" && (
              <PageEditor
                initial={panel.item}
                paper={store.data!.designs?.[panel.item.tripId]?.paper ?? "ruled"}
                saving={store.saving}
                onCancel={dismiss}
                onSave={async (item) => {
                  await changePages((pages) =>
                    pages.some((p) => p.id === item.id)
                      ? pages.map((p) => (p.id === item.id ? item : p))
                      : [...pages, item],
                  );
                  setPanel({ kind: "page", item });
                }}
              />
            )}
            {panel?.kind === "page" && (
              <PageDetail
                item={panel.item}
                paper={store.data!.designs?.[panel.item.tripId]?.paper ?? "ruled"}
                saving={store.saving}
                onEdit={() => setPanel({ kind: "page-edit", item: panel.item })}
                onToggleDone={() =>
                  safe(async () => {
                    const next = { ...panel.item, done: !panel.item.done };
                    await changePages((pages) => pages.map((p) => (p.id === next.id ? next : p)));
                    setPanel({ kind: "page", item: next });
                  })
                }
                onDelete={() =>
                  safe(async () => {
                    await changePages((pages) => pages.filter((p) => p.id !== panel.item.id));
                    setPanel(null);
                  })
                }
              />
            )}
            {panel?.kind === "expense" && trip && (
              <>
                <ExpenseEditor
                  trip={trip}
                  initial={panel.item}
                  draft={panel.draft}
                  history={otherExpenses}
                  saving={store.saving}
                  onCancel={dismiss}
                  onSave={async (item) => {
                    await changeTrip((t) => ({
                      ...t,
                      ledger: {
                        ...t.ledger,
                        expenses: t.ledger.expenses.some(
                          (e) => e.id === item.id,
                        )
                          ? t.ledger.expenses.map((e) =>
                              e.id === item.id ? item : e,
                            )
                          : [...t.ledger.expenses, item],
                      },
                    }));
                    setPanel(null);
                  }}
                />
                {panel.item && (
                  <View style={{ padding: 16 }}>
                    <Button
                      title={t("expense.delete")}
                      quiet
                      danger
                      disabled={store.saving}
                      onPress={() =>
                        Alert.alert(
                          t("expense.deleteTitle"),
                          t("expense.deleteBody"),
                          [
                            { text: t("common.keep"), style: "cancel" },
                            {
                              text: t("common.delete"),
                              style: "destructive",
                              onPress: () =>
                                safe(async () => {
                                  await changeTrip((t) => ({
                                    ...t,
                                    ledger: {
                                      ...t.ledger,
                                      expenses: t.ledger.expenses.filter(
                                        (e) => e.id !== panel.item!.id,
                                      ),
                                    },
                                  }));
                                  setPanel(null);
                                }),
                            },
                          ],
                        )
                      }
                    />
                  </View>
                )}
              </>
            )}
            {panel?.kind === "budget" && trip && (
              <BudgetSplit
                trip={trip}
                saving={store.saving}
                onSave={async ({ totalBudgetMinor, dailyBudgetMinor, categoryShares }) => {
                  await changeTrip((t) => ({
                    ...t,
                    budget: { ...t.budget, totalBudgetMinor, dailyBudgetMinor, categoryShares },
                  }));
                  setPanel(null);
                }}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}
