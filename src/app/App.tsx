import { ReservationsScreen } from "../features/reservations/ReservationsScreen";
import { ReservationQuickView } from "../features/reservations/ReservationQuickView";
import "../features/reservations/reservations.css";
import { deviceTimeZone, zonedDate } from "../domain/time/zoned";
import { useEffect, useState } from "react";
import { Layout, LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { osakaWorkspaceSeed } from "../data/scheduleSeed";
import { tripSeed } from "../data/tripSeed";
import {
  addTrip,
  removeTrip,
  selectTrip,
  setTripArchived,
} from "../domain/workspace/library";
import {
  createTrip,
  tripFormFromSettings,
  updateTripSettings,
  type TripFormInput,
} from "../domain/workspace/tripForm";
import { invalidateChangedRouteSegments } from "../domain/schedule/invalidateRouteSegments";
import { selectNextTransitRouteActivity } from "../domain/schedule/selectors";
import { AccessGate } from "../features/access/AccessGate";
import { BudgetScreen } from "../features/budget/BudgetScreen";
import { InfoScreen } from "../features/info/InfoScreen";
import { CoversScreen } from "../features/notebook/CoversScreen";
import { NotebookHeader } from "../features/notebook/NotebookHeader";
import { NotebookMenu } from "../features/notebook/NotebookMenu";
import { PlacesScreen } from "../features/notebook/PlacesScreen";
import { TripFormScreen } from "../features/notebook/TripFormScreen";
import { ScheduleScreen } from "../features/schedule/ScheduleScreen";
import { TransitHandoff } from "../features/transit/TransitHandoff";
import { TodayScreen } from "../features/today/TodayScreen";
import {
  PwaUpdatePrompt,
  type PwaUpdateController,
} from "../features/update/PwaUpdatePrompt";
import { useTripWorkspace } from "../features/workspace/useTripWorkspace";
import { PUBLIC_LEGAL_PATHS } from "../domain/legal/legal";
import type { TripLibraryRepository } from "../repositories/tripRepository";
import "../styles/tokens.css";
import "../styles/base.css";
import "../features/today/today.css";
import "../styles/transit.css";
import "../styles/schedule.css";
import "../styles/budget.css";
import "../styles/info.css";
import "../features/update/update.css";
import {
  screenForTab,
  screenFromHash,
  tabForScreen,
  type AppScreen,
} from "./screens";

interface AppProps {
  workspaceSeed?: import("../domain/workspace/types").TripWorkspace;
  now?: Date;
  dependencies?: AppDependencies;
  workspaceRepository?: TripLibraryRepository;
  pwaUpdateController?: PwaUpdateController;
  buildVersion?: string;
}

// 테스트가 오늘 화면의 1초 시계를 직접 움직일 때 쓴다.
export interface AppDependencies {
  clock: { now: () => Date };
}

const systemClock = { now: () => new Date() };

export function App({
  workspaceSeed,
  now,
  dependencies,
  workspaceRepository,
  pwaUpdateController,
  buildVersion = import.meta.env.VITE_APP_VERSION ?? "dev",
}: AppProps) {
  const [activeScreen, setActiveScreen] = useState<AppScreen>(() =>
    screenFromHash(window.location.hash),
  );
  const [requestedReservation, setRequestedReservation] = useState<{ tripId: string; id?: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {
    workspace,
    library,
    isHydrated,
    loadFailed,
    error: workspaceError,
    updateWorkspace,
    updateLibrary,
    importWorkspace,
    exportWorkspace,
    resetWorkspace,
  } = useTripWorkspace({ repository: workspaceRepository, seed: workspaceSeed });
  const clock = dependencies?.clock ?? systemClock;
  const [liveNow, setLiveNow] = useState(() => now ?? clock.now());

  useEffect(() => {
    if (now !== undefined) return;

    setLiveNow(clock.now());
    const timer = setInterval(() => setLiveNow(clock.now()), 1_000);
    return () => clearInterval(timer);
  }, [clock, now]);

  useEffect(() => {
    const onHashChange = () => setActiveScreen(screenFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function selectScreen(screen: AppScreen) {
    setActiveScreen(screen);
    window.history.replaceState(null, "", `#${screen}`);
  }

  const currentTime = now ?? liveNow;
  const routeRegistry = {
    timeZone: workspace.settings.timeZone,
    activities: workspace.id === osakaWorkspaceSeed.id ? tripSeed.activities : [],
  };
  const nextTransitActivity = selectNextTransitRouteActivity(
    workspace.schedule,
    routeRegistry,
    currentTime,
  );

  const activeTab = tabForScreen(activeScreen);
  const stamp = () => clock.now().toISOString();
  const planSwitch = (
    <SegmentedControl
      label="일정 보기"
      value={activeScreen === "schedule" ? "schedule" : "today"}
      onChange={(value) => selectScreen(value === "schedule" ? "schedule" : "today")}
    >
      <SegmentedControlItem value="today" label="오늘" />
      <SegmentedControlItem value="schedule" label="전체 일정" />
    </SegmentedControl>
  );

  function submitNewTrip(input: TripFormInput) {
    const createdAt = clock.now();
    const id = uniqueTripId(library.trips.map((trip) => trip.id), createdAt);
    updateLibrary((current) => addTrip(current, createTrip(input, { id, now: createdAt })));
    selectScreen("today");
  }

  let content;
  const needsCover = library.trips.length === 0 &&
    activeScreen !== "bookings" && (activeScreen !== "new-trip" || loadFailed);
  const displayedScreen = needsCover ? "covers" : activeScreen;
  switch (displayedScreen) {
    case "today":
      content = (
        <>
        <ReservationQuickView items={workspace.reservations ?? []} now={currentTime} onOpen={id => { setRequestedReservation({ tripId: workspace.id, id }); selectScreen("bookings"); }} />
        <TodayScreen
          plan={routeRegistry}
          schedulePlan={workspace.schedule}
          now={currentTime}
          onOpenTransit={() => selectScreen("transit")}
        />
        </>
      );
      break;
    case "schedule":
      content = (
        <ScheduleScreen key={workspace.id}
          plan={workspace.schedule}
          now={currentTime}
          onChange={(schedule) =>
            updateWorkspace((current) => ({
              ...current,
              schedule,
              routeSegments: invalidateChangedRouteSegments(
                current.schedule,
                schedule,
                current.routeSegments,
              ),
            }))
          }
        />
      );
      break;
    case "transit":
      content = (
        <div className="transit-page">
          <nav className="plan-back" aria-label="일정으로 돌아가기">
            <Link href="#today" isStandalone>
              ‹ 오늘
            </Link>
          </nav>
          {nextTransitActivity === undefined ? (
            <PlaceholderScreen
              title="교통편"
              message="이 날짜는 일정표에서 정확한 구간 지도를 Google 지도로 열 수 있습니다."
              actionLabel="전체 일정에서 경로 보기"
              onAction={() => selectScreen("schedule")}
            />
          ) : (
            <TransitHandoff activity={nextTransitActivity} />
          )}
          {/* 접근 코드는 이제 장소 검색·주변 맛집에만 쓴다. 입력 위치는 장소 화면 안내 문구와 맞춰 그대로 둔다. */}
          <AccessGate>{null}</AccessGate>
        </div>
      );
      break;
    case "places":
      content = <PlacesScreen schedule={workspace.schedule} />;
      break;
    case "budget":
      content =
        (
          <BudgetScreen key={workspace.id}
            workspace={workspace}
            now={currentTime}
            onChange={(nextWorkspace) =>
              updateWorkspace(() => nextWorkspace)
            }
          />
        );
      break;
    case "bookings":
      content = (
        <>
        {library.trips.length === 0 ? <a href="#covers">‹ 내 여행 수첩</a> : null}
        {library.trips.length > 0 && !loadFailed ? <ReservationsScreen key={workspace.id + (requestedReservation?.id ?? "")} trip={workspace} now={currentTime} initialSelected={requestedReservation?.tripId === workspace.id ? requestedReservation.id : undefined} onChange={reservations => updateWorkspace(current => ({ ...current, reservations }))} /> : null}
        <InfoScreen
          exportWorkspace={exportWorkspace}
          importWorkspace={importWorkspace}
          resetWorkspace={resetWorkspace}
          showTripDetails={workspace.id === osakaWorkspaceSeed.id}
          showReservationPlaceholder={false}
        />
        </>
      );
      break;
    case "covers":
      content = (
        <CoversScreen
          library={library}
          canCreate={!loadFailed}
          onOpenBackup={() => selectScreen("bookings")}
          onOpenTrip={(tripId) => {
            updateLibrary((current) => selectTrip(current, tripId, stamp()));
            selectScreen("today");
          }}
          onCreateTrip={() => selectScreen("new-trip")}
        />
      );
      break;
    case "new-trip":
      content = (
        <TripFormScreen
          mode="create"
          initial={newTripForm(currentTime)}
          onSubmit={submitNewTrip}
          backHref="#covers"
        />
      );
      break;
    case "trip-settings":
      content = (
        <TripFormScreen
          key={workspace.id}
          mode="edit"
          initial={tripFormFromSettings(workspace.settings)}
          trip={workspace}
          onSubmit={(input) => {
            updateWorkspace((trip) => updateTripSettings(trip, input, clock.now()));
            selectScreen("today");
          }}
          backHref="#today"
        />
      );
      break;
  }

  if (displayedScreen === "today" || displayedScreen === "schedule") {
    content = (
      <>
        <nav className="plan-switch" aria-label="일정 보기 전환">
          {planSwitch}
        </nav>
        {content}
      </>
    );
  }

  if (!isHydrated && isWorkspaceEditorScreen(activeScreen)) {
    content = <WorkspaceLoadingScreen title={workspaceScreenTitle(activeScreen)} />;
  }

  return (
    <Layout
      height="fill"
      header={
        activeTab === null || library.trips.length === 0 ? undefined : (
          <LayoutHeader className="app-frame__header" label="수첩 머리글">
            <NotebookHeader
              settings={workspace.settings}
              activeTab={activeTab}
              onSelectTab={(tab) => selectScreen(screenForTab(tab))}
              onOpenMenu={() => setIsMenuOpen(true)}
            />
          </LayoutHeader>
        )
      }
      content={
        <LayoutContent padding={0} className="app-frame__paper">
          {workspaceError === null ? null : (
            <p className="workspace-error" role="alert">
              {workspaceError}
            </p>
          )}
          {content}
          <footer className="app-legal-footer" aria-label="개인정보와 약관">
            <a href={PUBLIC_LEGAL_PATHS.privacy}>개인정보 처리방침</a>
            <a href={PUBLIC_LEGAL_PATHS.terms}>이용약관</a>
            <a href={PUBLIC_LEGAL_PATHS.accountDeletion}>계정·데이터 삭제</a>
          </footer>
          {activeScreen === "bookings" ? (
            <p className="app-build-version" aria-label="앱 버전">
              앱 버전 {buildVersion}
            </p>
          ) : null}
          {pwaUpdateController === undefined ? null : (
            <PwaUpdatePrompt controller={pwaUpdateController} />
          )}
          <NotebookMenu
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            settings={workspace.settings}
            canRemove={library.trips.length > 0}
            onOpenSettings={() => {
              setIsMenuOpen(false);
              selectScreen("trip-settings");
            }}
            onToggleArchived={() => {
              setIsMenuOpen(false);
              updateLibrary((current) =>
                setTripArchived(current, workspace.id, !workspace.settings.archived, stamp()),
              );
            }}
            onOpenBookings={() => {
              setIsMenuOpen(false);
              selectScreen("bookings");
            }}
            onRemove={() => {
              setIsMenuOpen(false);
              updateLibrary((current) => removeTrip(current, workspace.id, stamp()));
              selectScreen("covers");
            }}
          />
        </LayoutContent>
      }
    />
  );
}

type WorkspaceEditorScreen =
  | "schedule"
  | "budget"
  | "bookings"
  | "covers"
  | "new-trip"
  | "trip-settings";

// 저장값을 읽기 전에 편집 화면을 열면 시드 위에 고친 내용이 저장값에 덮일 수 있어 잠근다.
function isWorkspaceEditorScreen(screen: AppScreen): screen is WorkspaceEditorScreen {
  return (
    screen === "schedule" ||
    screen === "budget" ||
    screen === "bookings" ||
    screen === "covers" ||
    screen === "new-trip" ||
    screen === "trip-settings"
  );
}

function workspaceScreenTitle(screen: WorkspaceEditorScreen) {
  switch (screen) {
    case "schedule":
      return "전체 일정";
    case "budget":
      return "경비";
    case "bookings":
      return "예약";
    case "covers":
      return "내 여행 수첩";
    case "new-trip":
      return "새 수첩";
    case "trip-settings":
      return "여행 설정";
  }
}

// 새 수첩 양식의 기본값: 오늘부터 4일, 원화 정산, 동행자는 나 혼자.
function newTripForm(now: Date): TripFormInput {
  const start = new Date(now.getTime());
  const end = new Date(now.getTime() + 3 * 86_400_000);
  return {
    title: "",
    startDate: zonedDate(start, deviceTimeZone()),
    endDate: zonedDate(end, deviceTimeZone()),
    baseCurrency: "KRW",
    members: [{ name: "나" }],
    coverColor: "cobalt",
  };
}

function uniqueTripId(existing: string[], now: Date): string {
  const base = `trip-${now.getTime().toString(36)}`;
  let id = base;
  for (let suffix = 2; existing.includes(id); suffix += 1) id = `${base}-${suffix}`;
  return id;
}

function WorkspaceLoadingScreen({ title }: { title: string }) {
  return (
    <section className="placeholder-screen" aria-busy="true">
      <p>Escale</p>
      <h1>{title}</h1>
      <div>
        <p role="status">저장된 여행 데이터 확인 중</p>
      </div>
    </section>
  );
}

function PlaceholderScreen({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="placeholder-screen">
      <p>Escale</p>
      <h1>{title}</h1>
      <div>
        <p>{message}</p>
        {actionLabel === undefined || onAction === undefined ? null : (
          <button type="button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
