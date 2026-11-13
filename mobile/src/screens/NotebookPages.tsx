import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import type { PackingItem, PageEntry, PageKind } from "../data/model";
import type { Suggestion } from "../data/bookingAutofill";
import type { IconName } from "../theme/mono";
import type { Key } from "../i18n/strings";
import type { PassportState } from "../data/passport";
import type { SettlementTransfer } from "../../../src/domain/money/settleBalances";
import type { ExpenseDraft } from "./ExpenseEditor";
import { TodayPage } from "./TodayPage";
import { PlanPage, type PlanView } from "./PlanPage";
import { BudgetPage, type MoneyView } from "./BudgetPage";
import { PassportPage } from "./PassportPage";

export type Tab = "plan" | "today" | "money" | "passport";

/** 하단 탭 순서. 계획 · 오늘 · 돈 · 여권. */
export const tabs: { key: Tab; title: Key; icon: IconName }[] = [
  { key: "plan", title: "tab.plan", icon: "calendar" },
  { key: "today", title: "tab.today", icon: "sun" },
  { key: "money", title: "tab.money", icon: "wallet" },
  { key: "passport", title: "tab.passport", icon: "passport" },
];

interface Props {
  trip: TripWorkspace;
  /** 여권은 모든 여행의 도장을 모아 보여 준다. */
  trips: TripWorkspace[];
  pages: PageEntry[];
  tab: Tab;
  now: Date;
  setTab: (tab: Tab) => void;
  /** 계획의 시간표·캘린더·지도·예약이 함께 쓰는 고른 날짜. 탭을 오가도 유지한다. */
  planDate: string | undefined;
  setPlanDate: (date: string) => void;
  planView: PlanView;
  setPlanView: (view: PlanView) => void;
  moneyView: MoneyView;
  setMoneyView: (view: MoneyView) => void;
  passport: PassportState;
  passportReady: boolean;
  passportLoadError: boolean;
  retryPassport: () => void;
  passportSaveError: boolean;
  retryPassportSave: () => void;
  setTripCompleted: (tripId: string, completed: boolean) => Promise<void>;
  setTripCancelled: (tripId: string, cancelled: boolean) => Promise<void>;
  newPage: (kind: PageKind, preset?: { date: string; time?: string }) => void;
  openPage: (p: PageEntry) => void;
  openReservation: (r: Reservation) => void;
  onAddReservation: (date?: string) => void;
  openPicks: () => void;
  /** 오늘 탭의 "다녀왔어요". */
  changePage: (id: string, done: boolean) => Promise<void>;
  expense: (id?: string) => void;
  expenseDraft: (draft: ExpenseDraft) => void;
  budget: () => void;
  openMembers: () => void;
  recordPayment: (transfer: SettlementTransfer) => Promise<void>;
  removePayment: (id: string) => Promise<void>;
  packing: PackingItem[];
  openPacking: () => void;
  applyAutofill: (chosen: Suggestion[]) => Promise<void>;
  onSignIn?: () => void;
  saving: boolean;
}

export function NotebookPages(props: Props) {
  const { trip, trips, pages, tab, now, saving } = props;
  if (tab === "today")
    return (
      <TodayPage
        key={trip.id}
        trip={trip}
        pages={pages}
        packing={props.packing}
        now={now}
        saving={saving}
        openPage={props.openPage}
        openReservation={props.openReservation}
        openPlan={() => props.setTab("plan")}
        openMoney={() => props.setTab("money")}
        openPacking={props.openPacking}
        expense={() => props.expense()}
        setPlaceDone={(page, done) => props.changePage(page.id, done)}
      />
    );
  if (tab === "money")
    return (
      <BudgetPage
        trip={trip}
        now={now}
        saving={saving}
        view={props.moneyView}
        setView={props.setMoneyView}
        expense={props.expense}
        expenseDraft={props.expenseDraft}
        budget={props.budget}
        openMembers={props.openMembers}
        recordPayment={props.recordPayment}
        removePayment={props.removePayment}
      />
    );
  if (tab === "passport") return <PassportPage trips={trips} now={now} passport={props.passport} setCancelled={props.setTripCancelled} setCompleted={props.setTripCompleted} ready={props.passportReady} loadError={props.passportLoadError} retryLoad={props.retryPassport} saveError={props.passportSaveError} retrySave={props.retryPassportSave} />;
  return (
    <PlanPage
      trip={trip}
      pages={pages}
      now={now}
      date={props.planDate}
      setDate={props.setPlanDate}
      view={props.planView}
      setView={props.setPlanView}
      newPlan={(preset) => props.newPage("plan", preset)}
      newPlace={() => props.newPage("place")}
      openPage={props.openPage}
      openReservation={props.openReservation}
      onAddReservation={props.onAddReservation}
      openPicks={props.openPicks}
      onSignIn={props.onSignIn}
      saving={saving}
      applyAutofill={props.applyAutofill}
    />
  );
}
