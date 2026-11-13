import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { randomUUID } from "expo-crypto";
import type { TripExpense, TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import { isCurrentStay, sortedReservations } from "../../../src/domain/reservations/reservations";
import { convertToBase, formatMoney } from "../../../src/domain/money/currency";
import { localDateTime, zonedDate } from "../../../src/domain/time/zoned";
import type { PackingItem, PageEntry } from "../data/model";
import { envelopesFor, formatShort, knownRate } from "../data/budgetPlan";
import { fetchRate } from "../data/rates";
import { nextJourney, notebookDay, plansForDate, reservationSummary, shortDate, type Until } from "../data/notebookView";
import { packTitleOf, readPouch, spendIn, type PouchTopic } from "../data/pouchIntents";
import { spendExamples } from "../data/pouchExamples";
import type { CurrencyCode } from "../../../src/domain/money/types";
import { nextAirportArrival } from "../data/airportTime";
import { airportAnswer } from "../data/pouchAnswers";
import { requestPouchJudgment } from "../data/pouchJudge";
import { hasPremium, premiumCredential, type PremiumSettings } from "../data/premium";
import type { PouchIntentName, PouchJudgment } from "../../../src/domain/pouch/judgment";
import { KeyedError } from "../i18n/errors";
import * as ImagePicker from "expo-image-picker";
import { canReadReceipts, readReceiptLines } from "../../modules/receipt-text";
import { parseReceipt } from "../data/receipt";
import { useAiConsent } from "../legal/Legal";
import { useI18n } from "../i18n/I18n";
import { formatDay, formatUntil, type Key } from "../i18n/strings";
import { Bar, Caps, Check, Chip, Icon, IconButton, LineButton, Seal, SolidButton, Swatch, TextLink, TopBar, Wordmark, type IconName } from "../theme/mono";
import { diary, mono, radius, scrapbook, space, textRole } from "../theme/tokens";
import { tripBudgetSummary } from "../data/tripBudget";
import { categoryKey } from "./BudgetPage";
import { TravelBookings } from "../components/TravelBookings";
import { PackingList } from "./PackingList";
import { notebookRepository } from "../data/sqlite";
import type { ExpenseDraft } from "./ExpenseEditor";

// 여행 도구. 위에는 지금 꺼내 볼 것(다음 이동·오늘 밤 숙소·준비물·오늘 쓴 돈, 항공·숙소 예약), 아래에는 묻거나 적은 줄과 답 카드가 쌓인다.
// 말은 기기 안에서 readPouch로 읽는다. 답은 문장이 아니라 카드로 준다.

export type PouchReply =
  | { kind: "expense"; expenseId: string }
  | { kind: "needRate"; draft: ExpenseDraft }
  | { kind: "packed"; itemId: string; previous: boolean }
  | { kind: "packAdded"; itemId: string }
  | { kind: "journal"; text: string }
  | { kind: "ask"; topic: PouchTopic }
  | { kind: "unknown" }
  | { kind: "jev"; judgment: PouchJudgment }
  | { kind: "error"; key?: Key };
export type PouchEntry = { id: string; said?: string; reply: PouchReply; undone?: boolean };

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
// 이보다 확신이 낮으면 Jev의 판단을 쓰지 않고 예시를 보여 준다. 실제 기록을 보며 조정한다.
const JEV_MIN_CONFIDENCE = 0.5;
const JEV_TOPICS: Partial<Record<PouchIntentName, PouchTopic>> = {
  ask_left: "left",
  ask_stay: "stay",
  ask_next: "next",
  ask_tomorrow: "tomorrow",
  ask_pack: "pack",
  ask_bookings: "reservations",
  ask_today: "today",
};

interface Props {
  premium: PremiumSettings;
  trip: TripWorkspace;
  items: PackingItem[];
  pages: PageEntry[];
  now: Date;
  saving: boolean;
  log: PouchEntry[];
  setLog: (change: (log: PouchEntry[]) => PouchEntry[]) => void;
  onClose: () => void;
  onPacking: () => void;
  onReservation: (item: Reservation) => void;
  onAddReservation: () => void;
  onOpenPage: (page: PageEntry) => void;
  onAddItem: (title: string, done: boolean) => Promise<string>;
  onSetDone: (id: string, done: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAddExpense: (expense: TripExpense) => Promise<void>;
  onRemoveExpense: (id: string) => Promise<void>;
  onEditExpense: (expense: TripExpense) => void;
  onExpenseDraft: (draft: ExpenseDraft) => void;
  onJournal: (text: string) => Promise<void>;
}

const CHIPS: [PouchTopic, Key][] = [
  ["left", "pouch.chipLeft"],
  ["stay", "pouch.chipStay"],
  ["next", "pouch.chipNext"],
  ["airport", "pouch.chipAirport"],
  ["tomorrow", "pouch.chipTomorrow"],
  ["pack", "pouch.chipPack"],
  ["reservations", "pouch.chipBookings"],
  ["today", "pouch.chipToday"],
];

export function TravelPouch(props: Props) {
  const { trip, items, now, saving, log, setLog, onClose } = props;
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [showPacking, setShowPacking] = useState(false);
  const [pastPacking, setPastPacking] = useState<PackingItem[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const bookingsTop = useRef(0);
  const lastShownReply = useRef({ tripId: trip.id, id: log.at(-1)?.id });
  const insets = useSafeAreaInsets();
  // 키보드가 올라오면 마지막 답이 보이게 내리고, 홈 막대 여백은 키보드가 대신 차지하니 뺀다.
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const subs = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true)),
      Keyboard.addListener("keyboardDidShow", () => scroll.current?.scrollToEnd({ animated: true })),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  useEffect(() => {
    if (!showPacking) return;
    let active = true;
    setHistoryReady(false);
    // 지난 수첩은 읽기만 한다. 이 여행보다 먼저 끝난 수첩의 미체크 항목만 제안에 쓴다.
    void notebookRepository.load().then((data) => {
      const pastIds = new Set(data.library.trips.filter((book) => book.id !== trip.id && book.settings.endDate < trip.settings.startDate).map((book) => book.id));
      if (active) { setPastPacking((data.packing ?? []).filter((item) => pastIds.has(item.tripId))); setHistoryReady(true); }
    }).catch(() => { if (active) { setPastPacking([]); setHistoryReady(true); } });
    return () => { active = false; };
  }, [showPacking, trip.id, trip.settings.startDate]);
  const tz = trip.settings.timeZone;
  const { phase, today } = notebookDay(trip.settings, now);
  const journey = phase === "after" ? undefined : nextJourney(trip.reservations ?? [], now);
  const stay = stayFor(trip.reservations ?? [], now);

  const push = (said: string | undefined, reply: PouchReply) => setLog((l) => [...l.slice(-40), { id: randomUUID(), said, reply }]);
  const markUndone = (id: string) => setLog((l) => l.map((e) => (e.id === id ? { ...e, undone: true } : e)));
  const replace = (id: string, reply: PouchReply) => setLog((l) => l.map((e) => (e.id === id ? { ...e, reply } : e)));

  const [reading, setReading] = useState(false);
  // 영수증 사진: 기기 안에서 글자를 읽고 합계·가게 이름을 채운 지출 적기 화면을 연다.
  function receipt() {
    if (saving || reading) return;
    Alert.alert(t("receipt.title"), t("receipt.body"), [
      { text: t("receipt.camera"), onPress: () => void pick("camera") },
      { text: t("receipt.library"), onPress: () => void pick("library") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }
  async function pick(source: "camera" | "library") {
    // 앨범은 iOS 사진 선택기가 고른 사진만 넘겨줘서 권한을 묻지 않는다. 카메라만 묻는다.
    let uri: string | undefined;
    try {
      if (source === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return Alert.alert(t("receipt.denied"));
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9, exif: false };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      uri = result.canceled ? undefined : result.assets[0]?.uri;
    } catch {
      // 카메라가 없는 기기(시뮬레이터 등)이거나 선택 창을 열지 못했을 때
      return Alert.alert(t("receipt.unavailable"));
    }
    if (!uri) return;
    setReading(true);
    try {
      const draft = parseReceipt(await readReceiptLines(uri), trip.settings.localCurrency);
      if (!draft) return push(undefined, { kind: "error", key: "receipt.failed" });
      props.onExpenseDraft({ ...draft, title: draft.title || t(categoryKey(draft.category)) });
    } catch {
      push(undefined, { kind: "error", key: "receipt.failed" });
    } finally {
      setReading(false);
    }
  }

  async function send(raw: string) {
    const said = raw.trim();
    if (!said || saving) return;
    setText("");
    const intent = readPouch(said, { localCurrency: trip.settings.localCurrency, packing: items });
    try {
      switch (intent.kind) {
        case "expense": {
          const draft: ExpenseDraft = { title: intent.title || t(categoryKey(intent.category)), amount: intent.amount, currency: intent.currency, category: intent.category, method: intent.method };
          // 이 여행에서 쓴 환율이 없으면 오늘 기준가를 가져온다. 못 가져오면 직접 적게 넘긴다.
          const rateToBase = knownRate(trip, intent.currency) ?? (await fetchRate(intent.currency, trip.settings.baseCurrency))?.rate;
          if (!rateToBase) return push(said, { kind: "needRate", draft });
          const owner = trip.settings.ownerId;
          const expense: TripExpense = { id: randomUUID(), ...draft, amount: intent.amount, rateToBase, paidBy: { kind: "member", memberId: owner }, split: { kind: "even", memberIds: [owner] }, occurredAt: new Date().toISOString() };
          await props.onAddExpense(expense);
          return push(said, { kind: "expense", expenseId: expense.id });
        }
        case "packed": {
          const previous = items.find((i) => i.id === intent.itemId)?.done ?? false;
          if (previous !== intent.done) await props.onSetDone(intent.itemId, intent.done);
          return push(said, { kind: "packed", itemId: intent.itemId, previous });
        }
        case "packAdd": {
          if (items.length >= 200) return push(said, { kind: "error" });
          const id = await props.onAddItem(intent.title, intent.done);
          return push(said, { kind: "packAdded", itemId: id });
        }
        case "journal":
          await props.onJournal(intent.text);
          return push(said, { kind: "journal", text: intent.text });
        case "ask":
          return push(said, { kind: "ask", topic: intent.topic });
        default:
          return push(said, { kind: "unknown" });
      }
    } catch {
      push(said, { kind: "error" });
    }
  }

  if (showPacking) return <View style={{ flex: 1 }}>
    <TopBar left={<IconButton icon="back" label={t("common.back")} onPress={() => setShowPacking(false)} />} />
    <PackingList trip={trip} history={pastPacking} historyReady={historyReady} items={items} saving={saving}
      onToggle={props.onSetDone} onAdd={async (title) => { await props.onAddItem(title, false); }} onRemove={props.onRemove}
      onRename={async (item, title) => { await props.onAddItem(title, item.done); await props.onRemove(item.id); }} />
  </View>;

  return (
    <View style={{ flex: 1 }}>
      <TopBar
        left={<IconButton icon="close" label={t("kit.close")} disabled={saving} onPress={onClose} />}
        center={<Caps color={mono.ink}>{`${formatDay(lang, today)} · ${localDateTime(now, tz).slice(11, 16)}`}</Caps>}
      />
      <ScrollView
        ref={scroll}
        accessibilityLabel={t("pouch.log")}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => {
          // 예약 카드의 높이가 바뀌어도 처음 연 여행 도구가 예약을 지나쳐 내려가지 않게 한다.
          const id = log.at(-1)?.id;
          const previous = lastShownReply.current;
          lastShownReply.current = { tripId: trip.id, id };
          if (previous.tripId === trip.id && id && id !== previous.id) scroll.current?.scrollToEnd({ animated: true });
        }}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 20, gap: 14, backgroundColor: mono.bg }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Seal size={24} color={mono.accentText} />
          <Wordmark size={24} />
        </View>
        {journey && <NextCard reservation={journey.reservation} until={journey.until} onPress={() => props.onReservation(journey.reservation)} />}
        <WalletPanel trip={trip} />
        <PrepPanel
          items={items}
          stay={stay}
          bookings={(trip.reservations ?? []).length}
          disabled={saving}
          onPacking={() => setShowPacking(true)}
          onStay={() => (stay ? props.onReservation(stay) : props.onAddReservation())}
          onAddReservation={() => (trip.reservations?.length ? scroll.current?.scrollTo({ y: bookingsTop.current, animated: true }) : props.onAddReservation())}
        />
        {phase === "during" && <SpentCard trip={trip} date={today} />}
        {/* 항공·숙소는 오늘 탭에서 옮겨 와 여기 한곳에 모은다. 예약이 없어도 사진으로 가져오기를 바로 열 수 있다. */}
        <View onLayout={(event) => { bookingsTop.current = event.nativeEvent.layout.y; }}>
        <TravelBookings trip={trip} pages={props.pages} now={now} disabled={saving} onOpen={props.onReservation} onOpenPage={props.onOpenPage} onAdd={props.onAddReservation} />
        </View>

        {log.map((entry) => (
          <View key={entry.id} style={{ gap: 10 }}>
            {!!entry.said && <Bubble text={entry.said} />}
            <Reply entry={entry} props={{ ...props, onPacking: () => setShowPacking(true) }} today={today} markUndone={() => markUndone(entry.id)} fill={setText} replace={(reply) => replace(entry.id, reply)} />
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingTop: 12, paddingBottom: keyboard ? 10 : Math.max(insets.bottom, 10), gap: 12, backgroundColor: mono.frost, borderTopWidth: 1, borderColor: mono.hair }}>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: space.gutter }}>
          {CHIPS.filter(([topic]) => topic !== "airport" || !!nextAirportArrival(trip.reservations ?? [], now)).map(([topic, key]) => (
            <Chip key={topic} title={t(key)} onPress={() => topic==="pack" ? setShowPacking(true) : push(t(key), { kind: "ask", topic })} />
          ))}
        </ScrollView>
        <View style={{ marginHorizontal: space.gutter, minHeight: 56, paddingLeft: canReadReceipts ? 5 : 12, paddingRight: 5, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: mono.rule, borderRadius: radius.control, backgroundColor: mono.bg }}>
          {canReadReceipts && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("receipt.button")}
              disabled={saving || reading}
              onPress={receipt}
              style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: saving || reading ? 0.35 : pressed ? 0.6 : 1 })}
            >
              {reading ? <ActivityIndicator color={mono.ink} /> : <Icon name="camera" size={22} />}
            </Pressable>
          )}
          <TextInput
            accessibilityLabel={t("pouch.ask")}
            value={text}
            onChangeText={setText}
            placeholder={t("pouch.placeholder", { money: spendExamples(trip.settings.localCurrency, lang).taxi })}
            placeholderTextColor={mono.mutedText}
            maxLength={200}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => void send(text)}
            style={[textRole.body, { flex: 1, minHeight: 44, color: mono.ink }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("pouch.send")}
            disabled={saving || !text.trim()}
            onPress={() => void send(text)}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.control - 2, backgroundColor: mono.sea, alignItems: "center", justifyContent: "center", opacity: saving || !text.trim() ? 0.35 : pressed ? 0.7 : 1 })}
          >
            <Icon name="up" color={mono.onInk} weight={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** 여행 도구 맨 위의 지갑. 남은 예산을 크게, 쓴 만큼 막대를 채운다. 예산이 없으면 쓴 돈만 적는다. */
function WalletPanel({ trip }: { trip: TripWorkspace }) {
  const { t } = useI18n();
  const { total, spent, remaining } = tripBudgetSummary(trip);
  const money = (value: number) => formatMoney(value, trip.settings.baseCurrency);
  const over = remaining !== undefined && remaining < 0;
  return (
    <Panel title={t("pouch.wallet")}>
      <Text style={[textRole.meta, { color: mono.gray }]}>{total === undefined ? t("overview.spent") : t(over ? "overview.over" : "overview.remaining")}</Text>
      <Text style={[textRole.feature, { color: over ? mono.warn : mono.ink }]}>{money(total === undefined ? spent : Math.abs(remaining!))}</Text>
      {total !== undefined && <>
        <Bar ratio={total ? spent / total : spent > 0 ? 1 : 0} height={4} color={over ? mono.warn : scrapbook.pink} />
        <Text style={[textRole.meta, { fontVariant: ["tabular-nums"], color: mono.gray }]}>{`${t("overview.budget")} ${money(total)} · ${t("overview.spent")} ${money(spent)}`}</Text>
      </>}
    </Panel>
  );
}

/** 떠나기 전에 챙기는 것 세 줄: 준비물, 숙소, 예약. 비어 있으면 그 자리에서 바로 추가한다. */
function PrepPanel({ items, stay, bookings, disabled, onPacking, onStay, onAddReservation }: { items: PackingItem[]; stay?: Reservation; bookings: number; disabled: boolean; onPacking: () => void; onStay: () => void; onAddReservation: () => void }) {
  const { t } = useI18n();
  const done = items.filter((i) => i.done).length;
  return (
    <Panel title={t("pouch.prep")}>
      <PrepRow icon="check" title={t("pouch.pack")} sub={items.length ? items.filter((i) => !i.done).slice(0, 2).map((i) => i.title).join(", ") || t("pack.all") : t("pouch.packNone")} right={items.length ? `${done} / ${items.length}` : undefined} disabled={disabled} onPress={onPacking} />
      <PrepRow icon="book" title={t("pouch.stayRow")} sub={stay ? stay.title : t("pouch.noSavedStay")} add={!stay} disabled={disabled} onPress={onStay} />
      <PrepRow icon="clock" title={t("pouch.bookings")} sub={bookings ? t("pouch.bookingCount", { n: bookings }) : t("pouch.noBookings")} add={!bookings} disabled={disabled} onPress={onAddReservation} last />
    </Panel>
  );
}

function PrepRow({ icon, title, sub, right, add, disabled, last, onPress }: { icon: IconName; title: string; sub: string; right?: string; add?: boolean; disabled: boolean; last?: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, sub, right, add ? t("pouch.addShort") : undefined].filter(Boolean).join(", ")}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: last ? 0 : 1, borderColor: mono.hair, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: mono.bg }}>
        <Icon name={icon} size={18} color={scrapbook.tape} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[textRole.itemTitle, { color: mono.ink }]}>{title}</Text>
        <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray }]}>{sub}</Text>
      </View>
      {right && <Text style={[textRole.meta, { fontVariant: ["tabular-nums"], color: mono.ink }]}>{right}</Text>}
      {add ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="plus" size={14} color={mono.gray} />
          <Text style={[textRole.meta, { color: mono.gray }]}>{t("pouch.addShort")}</Text>
        </View>
      ) : <Icon name="chevron" size={16} color={mono.gray} />}
    </Pressable>
  );
}

/** 여행 도구의 묶음 면. 물빛 면 위에 이름표 하나와 내용. 큰 면의 둥근 모서리 하나만 쓴다. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8, padding: 18, borderRadius: diary.radius, backgroundColor: diary.surface, borderWidth: 1, borderColor: mono.hair }}>
      <Text accessibilityRole="header" style={[textRole.sectionTitle, { color: mono.ink, marginBottom: 2 }]}>{title}</Text>
      {children}
    </View>
  );
}

/** 오늘 밤 묵는 숙소. 없으면 다가오는 첫 숙소. */
function stayFor(reservations: Reservation[], now: Date) {
  const stays = sortedReservations(reservations).filter((r) => r.kind === "stay");
  return (
    stays.find((r) => isCurrentStay(r, now) || r.startDate === localDateTime(now, r.timeZone).slice(0, 10)) ??
    stays.find((r) => r.startDate >= localDateTime(now, r.timeZone).slice(0, 10))
  );
}

const addDay = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

// ── 답 카드 ─────────────────────────────────────────────

function Reply({ entry, props, today, markUndone, fill, replace }: { entry: PouchEntry; props: Props; today: string; markUndone: () => void; fill: (text: string) => void; replace: (reply: PouchReply) => void }) {
  const { t } = useI18n();
  const { reply } = entry;
  const { trip, items, now, saving } = props;
  const undo = (action: () => Promise<void>) => () =>
    void action().then(markUndone, () => Alert.alert(t("kit.saveError")));

  switch (reply.kind) {
    case "expense": {
      const e = trip.ledger.expenses.find((x) => x.id === reply.expenseId);
      if (!e) return <Note text={t(entry.undone ? "pouch.undone" : "pouch.gone")} />;
      return <ExpenseCard trip={trip} expense={e} saving={saving} onEdit={() => props.onEditExpense(e)} onUndo={undo(() => props.onRemoveExpense(e.id))} />;
    }
    case "needRate":
      return (
        <Card>
          <Caps color={mono.ink}>{t("pouch.spent")}</Caps>
          <ReceiptLine category={reply.draft.category} title={reply.draft.title ?? ""} amount={reply.draft.amount !== undefined ? formatShort(reply.draft.amount, reply.draft.currency) : t("pouch.noAmount")} />
          <Text style={[textRole.meta, { color: mono.gray }]}>{t("pouch.needRate", { from: reply.draft.currency })}</Text>
          <SolidButton title={t("pouch.finish")} disabled={saving} onPress={() => props.onExpenseDraft(reply.draft)} style={{ minHeight: 44 }} />
        </Card>
      );
    case "packed":
    case "packAdded": {
      const item = items.find((i) => i.id === reply.itemId);
      if (!item) return <Note text={t(entry.undone ? "pouch.undone" : "pouch.gone")} />;
      const done = items.filter((i) => i.done).length;
      const onUndo = reply.kind === "packed" ? undo(() => props.onSetDone(item.id, reply.previous)) : undo(() => props.onRemove(item.id));
      return (
        <Card>
          <Caps color={mono.ink}>{`${t("pouch.pack")} · ${done}/${items.length}`}</Caps>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
            <Check done={item.done} />
            <Text style={[textRole.itemTitle, { flex: 1, color: item.done ? mono.gray : mono.ink, textDecorationLine: item.done ? "line-through" : "none" }]}>{item.title}</Text>
            {entry.undone ? <Text style={[textRole.meta, { color: mono.gray }]}>{t("pouch.undone")}</Text> : <TextLink title={t("pouch.undo")} disabled={saving} onPress={onUndo} />}
          </View>
        </Card>
      );
    }
    case "journal":
      return (
        <Card>
          <Caps color={mono.ink}>{t("pouch.story")}</Caps>
          <Text style={[textRole.body, { color: mono.ink }]}>{reply.text}</Text>
          <Text style={[textRole.meta, { color: mono.gray }]}>{t("pouch.storySaved")}</Text>
        </Card>
      );
    case "ask":
      return <Answer topic={reply.topic} props={props} today={today} now={now} />;
    case "unknown":
      return <Unknown said={entry.said ?? ""} props={props} fill={fill} replace={replace} />;
    case "jev":
      return <JevReply said={entry.said ?? ""} judgment={reply.judgment} props={props} today={today} now={now} fill={fill} replace={replace} />;
    case "error":
      return <Note text={t(reply.key ?? "kit.saveError")} warn={!reply.key?.startsWith("limit.")} />;
  }
}

function Examples({ text, local, fill }: { text: string; local: CurrencyCode; fill: (text: string) => void }) {
  const { t, lang } = useI18n();
  return (
    <>
      <Text style={[textRole.meta, { color: mono.ink }]}>{text}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {t("pouch.examples", { money: spendExamples(local, lang).coffee }).split(" · ").map((example) => (
          <Chip key={example} title={example} onPress={() => fill(example)} />
        ))}
      </View>
    </>
  );
}

/** 기기에서 읽지 못한 줄. 유료 회원이면 Jev에게 다시 읽게 할 수 있다. 보낼지는 사용자가 정한다. */
function Unknown({ said, props, fill, replace }: { said: string; props: Props; fill: (text: string) => void; replace: (reply: PouchReply) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const credential = premiumCredential(props.premium, props.premium.accessCode);
  const canAsk = hasPremium(props.premium) && !!credential && !!API_BASE_URL && !!said.trim();
  const aiConsent = useAiConsent("pouch");
  async function ask() {
    // 이 줄을 미국의 TypeSafe로 보내기 전에 동의를 받는다.
    if (!(await aiConsent.ask())) return;
    setBusy(true);
    try {
      // 아직 안 챙긴 것부터 보낸다. 목록이 길어 잘려도 쓸모 있는 쪽이 남는다.
      const items = [...props.items].sort((a, b) => Number(a.done) - Number(b.done)).map((i) => ({ id: i.id, title: i.title }));
      replace({ kind: "jev", judgment: await requestPouchJudgment({ baseUrl: API_BASE_URL, accessCode: credential, text: said, items }) });
    } catch (e) {
      replace({ kind: "error", key: e instanceof KeyedError ? e.key : "import.failed" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Examples text={t("pouch.unknown")} local={props.trip.settings.localCurrency} fill={fill} />
      {canAsk && (
        <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderColor: mono.hair }}>
          <LineButton title={busy ? t("paste.reading") : t("pouch.askJev")} disabled={busy} onPress={() => void ask()} style={{ minHeight: 44 }} />
          <Text style={[textRole.meta, { color: mono.gray }]}>{t("pouch.jevNote")}</Text>
        </View>
      )}
      {aiConsent.sheet}
    </Card>
  );
}

/** Jev가 고른 의도. 묻는 말은 바로 답하고, 기록을 바꾸는 일은 버튼으로 한 번 더 확인받는다. */
function JevReply({ said, judgment, props, today, now, fill, replace }: { said: string; judgment: PouchJudgment; props: Props; today: string; now: Date; fill: (text: string) => void; replace: (reply: PouchReply) => void }) {
  const { t } = useI18n();
  const { trip, items, saving } = props;
  const sure = judgment.intent !== "other" && judgment.confidence >= JEV_MIN_CONFIDENCE;
  const topic = JEV_TOPICS[judgment.intent];
  const fail = () => replace({ kind: "error" });
  if (!sure)
    return (
      <Card>
        <Examples text={t("pouch.jevUnsure")} local={trip.settings.localCurrency} fill={fill} />
      </Card>
    );
  if (topic) return <Answer topic={topic} props={props} today={today} now={now} />;
  const label = <Caps color={mono.ink}>{"JEV"}</Caps>;
  switch (judgment.intent) {
    case "expense": {
      const found = spendIn(said, trip.settings.localCurrency);
      const draft: ExpenseDraft = {
        title: (found?.title || said).slice(0, 60),
        amount: found?.amount,
        currency: found?.currency ?? trip.settings.localCurrency,
        category: judgment.category,
        method: found?.method ?? "card",
      };
      return (
        <Card>
          {label}
          <Text style={[textRole.itemTitle, { color: mono.ink }]}>{t("pouch.suggestSpend")}</Text>
          <ReceiptLine category={draft.category} title={draft.title ?? ""} amount={draft.amount !== undefined ? formatShort(draft.amount, draft.currency) : t("pouch.noAmount")} />
          <SolidButton title={t("pouch.finish")} disabled={saving} onPress={() => props.onExpenseDraft(draft)} style={{ minHeight: 44 }} />
        </Card>
      );
    }
    case "packed":
    case "unpacked": {
      const item = items.find((i) => i.id === judgment.itemId);
      if (!item)
        return (
          <View style={{ gap: 10 }}>
            <Note text={t("pouch.whichItem")} />
            <PackCard {...props} />
          </View>
        );
      const done = judgment.intent === "packed";
      return (
        <Card>
          {label}
          <Text style={[textRole.itemTitle, { color: mono.ink }]}>{t(done ? "pouch.suggestPacked" : "pouch.suggestUnpacked")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
            <Check done={item.done} />
            <Text style={[textRole.body, { flex: 1, color: mono.ink }]}>{item.title}</Text>
          </View>
          <SolidButton
            title={t(done ? "pouch.markPacked" : "pouch.markUnpacked")}
            disabled={saving}
            style={{ minHeight: 44 }}
            onPress={() => {
              const previous = item.done;
              void props.onSetDone(item.id, done).then(() => replace({ kind: "packed", itemId: item.id, previous }), fail);
            }}
          />
        </Card>
      );
    }
    case "pack_add": {
      const title = (packTitleOf(said) || said).slice(0, 120);
      return (
        <Card>
          {label}
          <Text style={[textRole.itemTitle, { color: mono.ink }]}>{t("pouch.suggestAdd")}</Text>
          <Text style={[textRole.body, { color: mono.ink }]}>{title}</Text>
          <SolidButton
            title={t("pouch.add")}
            disabled={saving || items.length >= 200}
            style={{ minHeight: 44 }}
            onPress={() => void props.onAddItem(title, false).then((itemId) => replace({ kind: "packAdded", itemId }), fail)}
          />
        </Card>
      );
    }
    default: {
      // note: 문장 그대로 오늘 기록에 남긴다.
      const text = said.slice(0, 120);
      return (
        <Card>
          {label}
          <Text style={[textRole.itemTitle, { color: mono.ink }]}>{t("pouch.suggestNote")}</Text>
          <Text style={[textRole.body, { color: mono.ink }]}>{text}</Text>
          <SolidButton title={t("pouch.saveNote")} disabled={saving} style={{ minHeight: 44 }} onPress={() => void props.onJournal(text).then(() => replace({ kind: "journal", text }), fail)} />
        </Card>
      );
    }
  }
}

function Answer({ topic, props, today, now }: { topic: PouchTopic; props: Props; today: string; now: Date }) {
  const { t, lang } = useI18n();
  const { trip, pages } = props;
  switch (topic) {
    case "left":
      return <SpentCard trip={trip} date={today} detailed />;
    case "stay": {
      const stay = stayFor(trip.reservations ?? [], now);
      return stay ? <StayCard stay={stay} now={now} onPress={() => props.onReservation(stay)} /> : <Note text={t("pouch.noStay")} action={{ title: t("kit.addReservation"), icon: "plus", onPress: props.onAddReservation }} />;
    }
    case "next": {
      const journey = nextJourney(trip.reservations ?? [], now);
      return journey ? <NextCard reservation={journey.reservation} until={journey.until} onPress={() => props.onReservation(journey.reservation)} /> : <Note text={t("pouch.noNext")} />;
    }
    case "airport": {
      const arrival = nextAirportArrival(trip.reservations ?? [], now);
      if (!arrival) return <Note text={airportAnswer(undefined, lang)} action={{ title: t("kit.addReservation"), icon: "plus", onPress: props.onAddReservation }} />;
      return <Card onPress={() => props.onReservation(arrival.flight)} label={arrival.flight.title}>
        <Text style={[textRole.body, { color: mono.ink }]}>{airportAnswer(arrival, lang)}</Text>
      </Card>;
    }
    case "tomorrow": {
      const date = addDay(today);
      const plans = plansForDate(trip, pages, date).sort((a, b) => (a.page?.time ?? "99:99").localeCompare(b.page?.time ?? "99:99"));
      const first = plans[0];
      if (!first) return <Note text={t("pouch.noTomorrow")} />;
      return (
        <Card onPress={first.page ? () => props.onOpenPage(first.page!) : undefined} label={first.title}>
          <Caps color={mono.ink}>{`${t("pouch.tomorrow")} · ${shortDate(date)}`}</Caps>
          <Text style={[textRole.feature, { color: mono.ink }]}>{first.page?.time ?? t("pouch.anytime")}</Text>
          <Text style={[textRole.itemTitle, { color: mono.ink }]}>{first.title}</Text>
          {plans.length > 1 && <Text style={[textRole.meta, { color: mono.gray }]}>{t("today.more", { n: plans.length - 1 })}</Text>}
        </Card>
      );
    }
    case "pack":
      return <PackCard {...props} />;
    case "reservations":
      return <BookingsCard {...props} />;
    case "today": {
      const notes = pages.filter((p) => p.kind === "journal" && p.date === today);
      if (!notes.length) return <Note text={t("pouch.todayEmpty")} />;
      return (
        <Card>
          <Caps color={mono.ink}>{`${t("pouch.story")} · ${shortDate(today)}`}</Caps>
          {notes.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => props.onOpenPage(p)} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
              <Text style={[textRole.body, { color: mono.ink }]}>{p.title}</Text>
            </Pressable>
          ))}
        </Card>
      );
    }
  }
}

function NextCard({ reservation: r, until, onPress }: { reservation: Reservation; until: Until; onPress: () => void }) {
  const { t, lang } = useI18n();
  const label = t(r.kind === "flight" ? "today.flight" : "today.journey");
  const route = [r.departure, r.arrival].filter(Boolean).join(" → ");
  const soon = until.kind === "soon" ? `${until.hours}:${String(until.minutes).padStart(2, "0")}` : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${r.title}, ${r.startTime ?? ""}, ${formatUntil(lang, until)}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", backgroundColor: mono.ink, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ flex: 1, padding: 18, gap: 6 }}>
        <Caps color={mono.soft}>{label}</Caps>
        {/* 시트가 열리는 동안 너비가 0으로 재져서, 글자 맞춤(adjustsFontSizeToFit)을 쓰면 시각이 아주 작게 굳는다. 한 줄 말줄임으로 둔다. */}
        <Text numberOfLines={1} style={[textRole.feature, { color: mono.onInk }]}>
          {r.startTime ?? r.title}
        </Text>
        <Text numberOfLines={1} style={[textRole.meta, { color: mono.soft }]}>
          {route || r.title}
        </Text>
      </View>
      <View style={{ width: 96, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6, borderLeftWidth: 1.5, borderStyle: "dashed", borderColor: mono.soft }}>
        {soon ? (
          <>
            <Caps color={mono.soft}>{t("pouch.in")}</Caps>
            <Text style={[textRole.sectionTitle, { fontVariant: ["tabular-nums"], color: mono.onInk }]}>{soon}</Text>
          </>
        ) : (
          <Text style={[textRole.meta, { textAlign: "center", color: mono.onInk }]}>{formatUntil(lang, until)}</Text>
        )}
        {!!r.serviceNumber && <Text style={[textRole.label, { color: mono.soft }]}>{r.serviceNumber}</Text>}
      </View>
    </Pressable>
  );
}

function StayCard({ stay, now, compact, onPress }: { stay: Reservation; now: Date; compact?: boolean; onPress: () => void }) {
  const { t, lang } = useI18n();
  const tonight = isCurrentStay(stay, now) || stay.startDate === localDateTime(now, stay.timeZone).slice(0, 10);
  const time = (label: string, value?: string) => (
    <View style={{ gap: 4 }}>
      <Caps>{label}</Caps>
      <Text style={[textRole.feature, { color: mono.ink }]}>{value ?? "—"}</Text>
    </View>
  );
  return (
    <Card onPress={onPress} label={stay.title} fit={compact ? "half" : "reply"}>
      <Caps color={mono.ink}>{tonight ? t("pouch.tonight") : shortDate(stay.startDate)}</Caps>
      <Text numberOfLines={compact ? 3 : 2} style={[textRole.itemTitle, { color: mono.ink }]}>
        {stay.title}
      </Text>
      {stay.startTime || stay.endTime ? (
        <View style={{ flexDirection: "row", gap: 20, marginTop: "auto", paddingTop: 8 }}>
          {time(t("pouch.checkIn"), stay.startTime)}
          {!compact && <View style={{ width: 1, backgroundColor: mono.hair }} />}
          {!compact && time(t("pouch.checkOut"), stay.endTime)}
        </View>
      ) : (
        <Text style={[textRole.meta, { marginTop: "auto", paddingTop: 8, color: mono.gray }]}>{reservationSummary(stay, lang).split("\n")[0]}</Text>
      )}
    </Card>
  );
}

function PackCard({ items, saving, onSetDone, onRemove, onPacking, compact }: Props & { compact?: boolean }) {
  const { t } = useI18n();
  const done = items.filter((i) => i.done).length;
  // 접힌 카드에는 아직 안 챙긴 것부터 셋만.
  const shown = compact ? [...items].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 3) : items;
  const remove = (item: PackingItem) =>
    Alert.alert(t("kit.deleteTitle"), item.title, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("kit.delete"), style: "destructive", onPress: () => void onRemove(item.id).catch(() => Alert.alert(t("kit.saveError"))) },
    ]);
  return (
    <Card fit={compact ? "half" : "reply"}>
      <Caps color={mono.ink}>{items.length ? `${t("pouch.pack")} · ${done}/${items.length}` : t("pouch.pack")}</Caps>
      {shown.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.done }}
          accessibilityLabel={item.title}
          disabled={saving}
          onPress={() => void onSetDone(item.id, !item.done).catch(() => Alert.alert(t("kit.saveError")))}
          onLongPress={compact ? undefined : () => remove(item)}
          style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Check done={item.done} size={18} />
          <Text numberOfLines={1} style={[textRole.meta, { flex: 1, color: item.done ? mono.gray : mono.ink, textDecorationLine: item.done ? "line-through" : "none" }]}>
            {item.title}
          </Text>
        </Pressable>
      ))}
      <TextLink title={t("pack.all")} onPress={onPacking} disabled={saving}/>
      {!items.length && <Text style={[textRole.meta, { color: mono.gray }]}>{t("pouch.packEmpty")}</Text>}
      {!compact && <Text style={[textRole.meta, { color: mono.gray }]}>{t("pouch.packHint")}</Text>}
    </Card>
  );
}

function SpentCard({ trip, date, detailed }: { trip: TripWorkspace; date: string; detailed?: boolean }) {
  const { t } = useI18n();
  const base = trip.settings.baseCurrency;
  const day = envelopesFor(trip, date);
  if (day.daily === undefined)
    return (
      <Card fit={detailed ? "reply" : "wide"}>
        <Caps color={mono.ink}>{t("today.spent")}</Caps>
        <Text style={[textRole.pageTitle, { fontVariant: ["tabular-nums"], color: mono.ink }]}>{formatMoney(day.spent, base)}</Text>
        {detailed && <Text style={[textRole.meta, { color: mono.gray }]}>{t("today.noBudget")}</Text>}
      </Card>
    );
  const left = day.daily - day.spent;
  return (
    <Card fit={detailed ? "reply" : "wide"}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <Caps color={mono.ink}>{detailed ? t("pouch.leftToday") : t("today.spent")}</Caps>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={[textRole.pageTitle, { fontVariant: ["tabular-nums"], color: detailed && left < 0 ? mono.warn : mono.ink }]}>{formatMoney(detailed ? Math.abs(left) : day.spent, base)}</Text>
          <Text style={[textRole.meta, { color: mono.gray }]}>{detailed ? (left < 0 ? t("today.over") : `/ ${formatMoney(day.daily, base)}`) : `/ ${formatMoney(day.daily, base)}`}</Text>
        </View>
      </View>
      <Bar ratio={day.daily ? day.spent / day.daily : 1} height={3} />
      {detailed &&
        day.envelopes
          .filter((e) => e.limit)
          .map((e) => {
            const rest = e.limit! - e.spent;
            return (
              <View key={e.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Swatch category={e.key} size={8} />
                <Text style={[textRole.meta, { flex: 1, color: mono.ink }]}>{t(categoryKey(e.key))}</Text>
                <Text style={[textRole.meta, { fontWeight: "600", color: rest < 0 ? mono.warn : mono.ink }]}>
                  {rest < 0 ? t("pouch.over", { amount: formatMoney(-rest, base) }) : t("pouch.left", { amount: formatMoney(rest, base) })}
                </Text>
              </View>
            );
          })}
    </Card>
  );
}

function BookingsCard({ trip, saving, onReservation, onAddReservation }: Props) {
  const { t, lang } = useI18n();
  const list = sortedReservations(trip.reservations ?? []);
  return (
    <Card>
      <Caps color={mono.ink}>{list.length ? `${t("pouch.bookings")} · ${list.length}` : t("pouch.bookings")}</Caps>
      {list.map((r, i) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={`${r.title}, ${reservationSummary(r, lang)}`}
          disabled={saving}
          onPress={() => onReservation(r)}
          style={({ pressed }) => ({ minHeight: 44, paddingVertical: 10, gap: 3, borderTopWidth: i ? 1 : 0, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
        >
          <Caps>{t(({ stay: "kit.stay", flight: "kit.flight", transport: "kit.transport", activity: "kit.activity" } as const)[r.kind])}</Caps>
          <Text style={[textRole.itemTitle, { color: mono.ink }]}>{r.title}</Text>
          <Text style={[textRole.meta, { color: mono.gray }]}>{reservationSummary(r, lang)}</Text>
        </Pressable>
      ))}
      {!list.length && <Text style={[textRole.meta, { color: mono.gray }]}>{t("kit.emptyReservations")}</Text>}
      <LineButton title={t("kit.addReservation")} icon="plus" disabled={saving || list.length >= 100} onPress={onAddReservation} />
      <Text style={[textRole.meta, { color: mono.gray }]}>{t("kit.private")}</Text>
    </Card>
  );
}

function ExpenseCard({ trip, expense: e, saving, onEdit, onUndo }: { trip: TripWorkspace; expense: TripExpense; saving: boolean; onEdit: () => void; onUndo: () => void }) {
  const { t } = useI18n();
  const base = trip.settings.baseCurrency;
  const envelope = envelopesFor(trip, zonedDate(e.occurredAt, trip.settings.timeZone)).envelopes.find((x) => x.key === e.category);
  const rest = envelope?.limit === undefined ? undefined : envelope.limit - envelope.spent;
  const meta = [e.currency !== base ? formatMoney(convertToBase(e, base), base) : "", t(e.method === "cash" ? "expense.cash" : "expense.card")].filter(Boolean).join(" · ");
  return (
    <Card>
      <Caps color={mono.ink}>{t("pouch.spent")}</Caps>
      <ReceiptLine category={e.category} title={e.title ?? ""} amount={formatShort(e.amount, e.currency)} />
      <Text style={[textRole.meta, { alignSelf: "flex-end", color: mono.gray }]}>{meta}</Text>
      {rest !== undefined && (
        <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderColor: mono.hair }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[textRole.meta, { flexShrink: 1, color: mono.ink }]}>{t("expense.envelope", { name: t(categoryKey(e.category)) })}</Text>
            <Text style={[textRole.meta, { fontWeight: "600", color: rest < 0 ? mono.warn : mono.ink }]}>
              {rest < 0 ? t("pouch.over", { amount: formatMoney(-rest, base) }) : t("pouch.left", { amount: formatMoney(rest, base) })}
            </Text>
          </View>
          <Bar ratio={envelope!.limit ? envelope!.spent / envelope!.limit! : 1} height={3} />
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 }}>
        <LineButton title={t("pouch.edit")} disabled={saving} onPress={onEdit} />
        <TextLink title={t("pouch.undo")} disabled={saving} onPress={onUndo} />
      </View>
    </Card>
  );
}

function ReceiptLine({ category, title, amount }: { category: TripExpense["category"]; title: string; amount: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Swatch category={category} />
      <Text numberOfLines={2} style={[textRole.itemTitle, { flex: 1, color: mono.ink }]}>
        {title}
      </Text>
      <Text style={[textRole.pageTitle, { fontVariant: ["tabular-nums"], color: mono.ink }]}>{amount}</Text>
    </View>
  );
}

// ── 바탕 조각 ─────────────────────────────────────────────

/** 답 카드 틀. 얇은 검은 테두리에 반쯤 비치는 흰 바탕. reply는 왼쪽에 붙는 답, wide는 한 줄 전체, half는 둘이 나란히. */
function Card({ children, onPress, label, fit = "reply" }: { children: ReactNode; onPress?: () => void; label?: string; fit?: "reply" | "wide" | "half" }) {
  const frame = {
    ...(fit === "reply" ? { width: "88%" as const, alignSelf: "flex-start" as const } : fit === "wide" ? { alignSelf: "stretch" as const } : { flex: 1 }),
    padding: 16,
    gap: 8,
    borderWidth: 1.5,
    borderColor: mono.ink,
    backgroundColor: mono.frost,
  };
  if (!onPress) return <View style={frame}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [frame, { opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

function Note({ text, warn, action }: { text: string; warn?: boolean; action?: { title: string; onPress: () => void; icon?: IconName } }) {
  return (
    <Card>
      <Text style={[textRole.meta, { color: warn ? mono.warn : mono.ink }]}>{text}</Text>
      {action && <LineButton title={action.title} icon={action.icon} onPress={action.onPress} />}
    </Card>
  );
}

function Bubble({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: "flex-end", maxWidth: "78%", paddingVertical: 11, paddingHorizontal: 15, backgroundColor: mono.ink }}>
      <Text style={[textRole.meta, { color: mono.bg }]}>{text}</Text>
    </View>
  );
}
