import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, ScrollView, Text, View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { BrowseNear } from "../../../src/domain/places/browse";
import { randomUUID } from "expo-crypto";
import { ChapterHeading } from "../components/ChapterHeading";
import { DayStrip } from "../components/DayStrip";
import { useLocatedTargets } from "../components/DayMap";
import type { PageEntry } from "../data/model";
import { notebookDay } from "../data/notebookView";
import { clock, dayPlan, mapTargets, tripDays } from "../data/dayPlan";
import { stayOptions, type BrowseUsage } from "../data/placeBrowse";
import { isStayAutofill } from "../data/bookingAutofill";
import { stayPoint } from "../data/stayPoint";
import { usePlaceAccess } from "../data/usePlaceAccess";
import {
  BUDGETS,
  INTERESTS,
  PACES,
  buildDraft,
  chooseBase,
  dayWindow,
  directionsUrl,
  draftToPages,
  fitSlot,
  knownPlaces,
  pickToPage,
  reasonLine,
  recommendDay,
  swapDraftItem,
  wantsDraft,
  type DayBase,
  type DraftDay,
  type Pick,
  type Taste,
} from "../data/recommend";
import { candidateKey, loadCandidates, rememberedCandidates, tasteStore, type CandidateSet } from "../data/recommendLoad";
import { useI18n } from "../i18n/I18n";
import { KeyedError } from "../i18n/errors";
import { formatDay, type Key } from "../i18n/strings";
import { GoogleMapsAttribution } from "../legal/GoogleMapsAttribution";
import { Chip, EmptyState, SectionHead, SolidButton, TextLink } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";

const DEFAULT_TASTE: Taste = { pace: "normal", interests: [], budget: "mid" };

// 수첩의 추천 탭. 고른 날의 기준점(그날 일정 → 그날 밤 숙소 → 여행지 중심) 근처에서 시간대별로 고른다.
// 검색은 사용자가 "이날 추천 받기"를 누를 때만 한다. 같은 기준점의 결과는 앱을 켜 둔 동안 다시 쓴다.
export function PicksPage({ trip, pages, now, onAdd }: { trip: TripWorkspace; pages: PageEntry[]; now: Date; onAdd: (entries: PageEntry[]) => Promise<void> }) {
  const { t, title, lang } = useI18n();
  const access = usePlaceAccess();
  const destination = trip.settings.destination?.trim() ?? "";
  const days = tripDays(trip.settings, now);
  const { today } = notebookDay(trip.settings, now);
  const [selected, setSelected] = useState(() => notebookDay(trip.settings, now).date);
  const day = days.find((d) => d.date === selected) ?? days[0];
  const date = day.date;

  // 취향: undefined는 읽는 중, null은 아직 답하지 않음.
  const [taste, setTaste] = useState<Taste | null | undefined>(undefined);
  const [editing, setEditing] = useState<Taste | null>(null);
  useEffect(() => {
    let alive = true;
    setTaste(undefined);
    tasteStore.get(trip.id).then((value) => alive && setTaste(value), () => alive && setTaste(null));
    return () => {
      alive = false;
    };
  }, [trip.id]);

  // 그날 기준점. 계획 지도와 같은 위치 캐시를 쓰므로 계획 탭에서 이미 찾은 곳은 다시 묻지 않는다.
  const plan = dayPlan(trip, pages, date, lang);
  const targets = mapTargets(plan);
  const [locatedDate, setLocatedDate] = useState<string | null>(null);
  const [pendingDay, setPendingDay] = useState<string | null>(null);
  // 위치 조회도 사용자가 추천을 요청한 날에만 시작한다.
  const located = useLocatedTargets(locatedDate === date ? targets : []);
  // 예약에서 넣은 체크인·체크아웃 줄은 일정이 아니라 숙소로 본다. 체크아웃 날처럼 그날 밤 숙소가 없어도 기준점이 숙소가 된다.
  const lodging = (p: { id: string }) => p.id.startsWith("page-") && isStayAutofill(p.id.slice("page-".length));
  const sleep = located.points.find((p) => p.id.startsWith("sleep-")) ?? located.points.find(lodging);
  const [center, setCenter] = useState<BrowseNear | null>(null);
  const base = chooseBase({
    plan: located.points.filter((p) => !p.id.startsWith("sleep-") && !lodging(p)),
    stay: sleep ? { point: sleep, title: sleep.title } : undefined,
    center: center ?? undefined,
    destination,
  });

  const [, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<BrowseUsage | null>(null);
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  // 이번에 담은 곳은 목록에서 빼지 않고 "담았어요"로 남긴다.
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<DraftDay[] | null>(null);
  useEffect(() => {
    setError("");
    setNotice("");
  }, [date]);

  const set: CandidateSet | undefined = base ? rememberedCandidates(candidateKey(trip.id, lang, base.point)) : undefined;
  const addedKey = (placeId: string) => `${date}|${placeId}`;
  const known = useMemo(() => knownPlaces(pages.filter((p) => !p.placeId || p.date !== date || !added.has(`${p.date}|${p.placeId}`))), [pages, added, date]);
  const window = dayWindow(trip.reservations, date, trip.settings.timeZone);
  const sections = set && base && taste ? recommendDay({ candidates: set.places, date, base, taste, window, known }) : [];
  const shortDay = !SLOT_ANY.some((slot) => fitSlot(slot, window));

  /** 기준점을 정한다. 일정·숙소 위치가 없으면 여행지 이름으로 중심을 찾는다(기기 캐시 30일). */
  async function resolveBase(): Promise<DayBase | null> {
    return base ?? centerBase();
  }

  async function run(job: () => Promise<void>) {
    // 검색 중 연속으로 누르면 검색 한도가 두 번 줄 수 있어 막는다.
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await job();
    } catch (e) {
      setError(t(e instanceof KeyedError ? e.key : "browse.failed"));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  const call = { baseUrl: access.baseUrl, credential: access.credential, lang, destination, tripId: trip.id, onUsage: setUsage };
  function getPicks() {
    if (!access.credential || !access.baseUrl) {
      setError(t(!access.credential ? "place.signIn" : "place.noServer"));
      return;
    }
    if (targets.length && locatedDate !== date) {
      setPendingDay(date);
      setLocatedDate(date);
      return;
    }
    void run(async () => {
      const b = await resolveBase();
      if (!b) return setError(t("pick.noBase"));
      await loadCandidates({ ...call, near: b.point });
      setVersion((v) => v + 1);
    });
  }
  useEffect(() => {
    if (pendingDay === date && locatedDate === date && located.pending === 0) {
      setPendingDay(null);
      getPicks();
    }
  }, [pendingDay, locatedDate, date, located.pending]);

  function makeDraft() {
    if (!taste) return;
    void run(async () => {
      // 초안은 숙소(없으면 여행지 중심) 한 곳을 기준으로 후보를 한 번만 받아 날마다 나눠 쓴다.
      const stay = stayOptions(trip.reservations, destination, today)[0];
      const stayAt = stay ? await stayPoint({ baseUrl: access.baseUrl, credential: access.credential, lang }, stay) : null;
      const b = stayAt ? chooseBase({ plan: [], stay: { point: stayAt, title: stay!.title }, destination }) : await centerBase();
      if (!b) return setError(t("pick.noBase"));
      const candidates = await loadCandidates({ ...call, near: b.point });
      const busyDates = new Set(pages.filter((p) => p.kind === "plan").map((p) => p.date));
      const result = buildDraft({ dates: days.map((d) => d.date), busyDates, candidates: candidates.places, base: b, taste, reservations: trip.reservations, tripZone: trip.settings.timeZone, known });
      if (!result.length) return setError(t("draft.empty"));
      setDraft(result);
    });
  }
  /** 여행지 이름으로 찾은 중심. 기기 위치 캐시(30일)를 먼저 본다. */
  async function centerBase(): Promise<DayBase | null> {
    if (!destination) return null;
    const point = center ?? (await stayPoint({ baseUrl: access.baseUrl, credential: access.credential, lang }, { id: "center", title: destination, query: destination }));
    if (point) setCenter(point);
    return chooseBase({ plan: [], center: point ?? undefined, destination });
  }

  async function save(pick: Pick, at: { start: number; minutes: number }) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    try {
      await onAdd([pickToPage(pick, at, { tripId: trip.id, id: randomUUID(), date, pages })]);
      setAdded((prev) => new Set(prev).add(addedKey(pick.place.placeId)));
    } catch {
      setError(t("browse.saveFailed"));
    } finally {
      busy.current = false;
    }
  }

  async function confirmDraft() {
    if (!draft || busy.current) return;
    busy.current = true;
    setError("");
    try {
      const entries = draftToPages(draft, trip.id, randomUUID);
      await onAdd(entries);
      setDraft(null);
      setNotice(t("draft.added", { n: entries.length }));
    } catch {
      setError(t("browse.saveFailed"));
    } finally {
      busy.current = false;
    }
  }

  async function openMap(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      setError(t("route.mapsFailed"));
    }
  }

  async function saveTaste(next: Taste) {
    setTaste(next);
    setEditing(null);
    await tasteStore.set(trip.id, next).catch(() => undefined);
  }

  const header = (
    <ChapterHeading title={title("picks")} sub={t("pick.sub", { n: day.index, date: formatDay(lang, date) })} />
  );

  if (taste === undefined)
    return (
      <ScrollView contentContainerStyle={page}>
        {header}
      </ScrollView>
    );

  if (taste === null || editing)
    return (
      <ScrollView contentContainerStyle={page}>
        {header}
        <TasteForm initial={editing ?? taste ?? DEFAULT_TASTE} onDone={(next) => void saveTaste(next)} onCancel={taste ? () => setEditing(null) : undefined} />
      </ScrollView>
    );

  if (draft)
    return (
      <ScrollView contentContainerStyle={page}>
        {header}
        <DraftView draft={draft} setDraft={setDraft} onConfirm={() => void confirmDraft()} onCancel={() => setDraft(null)} />
        {!!error && <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.warn }]}>{error}</Text>}
      </ScrollView>
    );

  const baseLine = base ? t(`pick.base.${base.kind}` as Key, { name: base.label }) : "";
  return (
    <ScrollView contentContainerStyle={page}>
      {header}
      <DayStrip days={days} selected={date} today={today} label={(d) => `${t("pick.sub", { n: d.index, date: formatDay(lang, d.date) })}`} onSelect={setSelected} />
      {wantsDraft(trip.reservations, pages, days.map((d) => d.date)) && (
        <View style={{ gap: 4 }}>
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("draft.offer")}</Text>
          <TextLink title={loading ? t("draft.making") : t("draft.make")} disabled={loading} onPress={makeDraft} />
        </View>
      )}
      {!!error && <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.warn }]}>{error}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={[textRole.meta, { color: mono.ink }]}>{notice}</Text>}
      {!!baseLine && <Text style={[textRole.meta, { color: mono.gray }]}>{baseLine}</Text>}
      {shortDay ? (
        <EmptyState text={t("pick.shortDay")} />
      ) : loading || pendingDay === date ? (
        <View style={{ paddingVertical: 28, gap: 12, alignItems: "center" }}>
          <ActivityIndicator color={mono.ink} />
          <Text style={[textRole.meta, { color: mono.gray }]}>{t("pick.loading")}</Text>
        </View>
      ) : !set ? (
        <View style={{ gap: space.group }}>
          {!destination && !base ? (
            <EmptyState text={t("browse.destination")} />
          ) : (
            <>
              <SolidButton title={t("pick.get")} onPress={getPicks} />
              <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("pick.getHint")}</Text>
            </>
          )}
        </View>
      ) : (
        <View style={{ gap: space.section }}>
          {set.legacy && <Text style={[textRole.meta, { color: mono.gray }]}>{t("pick.oldServer")}</Text>}
          {!sections.length && <EmptyState text={t("pick.none")} />}
          {sections.map((section) => (
            <View key={section.slot}>
              <SectionHead title={`${t(`slot.${section.slot}` as Key)} · ${clock(section.start)}`} />
              {section.picks.map((pick) => (
                <PickCard
                  key={pick.place.placeId}
                  pick={pick}
                  saved={added.has(addedKey(pick.place.placeId))}
                  onSave={() => void save(pick, section)}
                  onMap={() => void openMap(directionsUrl(base?.point ?? null, pick.place))}
                />
              ))}
            </View>
          ))}
          {!!sections.length && <GoogleMapsAttribution />}
        </View>
      )}
      {usage && <Text style={[textRole.meta, { color: mono.gray }]}>{usage.tier === "admin" ? t("browse.admin") : t("browse.remaining", { n: usage.remaining ?? 0, limit: usage.limit ?? 0 })}</Text>}
      <TextLink tone="dismiss" title={t("taste.edit")} onPress={() => setEditing(taste)} />
    </ScrollView>
  );
}

const SLOT_ANY = ["morning", "lunch", "afternoon", "dinner", "night"] as const;
const page = { paddingHorizontal: space.gutter, paddingTop: 14, paddingBottom: 40, gap: space.gutter };

/** 추천 한 곳. 담기 하나와 길 보기 하나만 둔다. */
function PickCard({ pick, saved, onSave, onMap }: { pick: Pick; saved: boolean; onSave: () => void; onMap: () => void }) {
  const { t, lang } = useI18n();
  const { place } = pick;
  const meta = [place.type, place.rating !== undefined ? t("pick.rating", { r: place.rating.toFixed(1), n: (place.reviews ?? 0).toLocaleString() }) : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ gap: 4, paddingVertical: 14, borderBottomWidth: 1, borderColor: mono.hair }}>
      <Text style={[textRole.itemTitle, { color: mono.ink }]}>{place.name}</Text>
      {!!meta && <Text style={[textRole.meta, { color: mono.gray }]}>{meta}</Text>}
      <Text style={[textRole.meta, { color: mono.ink }]}>{reasonLine(pick.reason, lang)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.gutter }}>
        <TextLink title={t(saved ? "pick.saved" : "pick.save")} label={t("pick.saveA11y", { name: place.name })} disabled={saved} onPress={onSave} />
        <TextLink tone="dismiss" title={t("pick.directions")} label={`${place.name} ${t("pick.directions")}`} onPress={onMap} />
      </View>
    </View>
  );
}

/** 수첩마다 한 번 묻는 세 가지. */
function TasteForm({ initial, onDone, onCancel }: { initial: Taste; onDone: (taste: Taste) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const group = (label: string, chips: ReactNode, single = false) => (
    <View style={{ gap: space.group }}>
      <Text style={[textRole.label, { color: mono.gray }]}>{label}</Text>
      <View accessibilityRole={single ? "radiogroup" : undefined} accessibilityLabel={single ? label : undefined} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{chips}</View>
    </View>
  );
  return (
    <View style={{ gap: space.gutter }}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={[textRole.sectionTitle, { color: mono.ink }]}>{t("taste.title")}</Text>
        <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("taste.sub")}</Text>
      </View>
      {group(t("taste.pace"), PACES.map((pace) => <Chip key={pace} role="radio" title={t(`taste.pace.${pace}` as Key)} selected={value.pace === pace} onPress={() => setValue({ ...value, pace })} />), true)}
      {group(
        t("taste.interests"),
        INTERESTS.map((interest) => {
          const on = value.interests.includes(interest);
          return <Chip key={interest} role="checkbox" title={t(`taste.interest.${interest}` as Key)} selected={on} onPress={() => setValue({ ...value, interests: on ? value.interests.filter((i) => i !== interest) : [...value.interests, interest] })} />;
        }),
      )}
      {group(t("taste.budget"), BUDGETS.map((budget) => <Chip key={budget} role="radio" title={t(`taste.budget.${budget}` as Key)} selected={value.budget === budget} onPress={() => setValue({ ...value, budget })} />), true)}
      <SolidButton title={t("taste.done")} onPress={() => onDone(value)} />
      {onCancel && <TextLink tone="dismiss" title={t("common.cancel")} onPress={onCancel} />}
    </View>
  );
}

/** 확인 전 초안. 줄마다 다른 곳으로 바꾸거나 뺀 뒤 한 번에 계획에 넣는다. */
function DraftView({ draft, setDraft, onConfirm, onCancel }: { draft: DraftDay[]; setDraft: (next: DraftDay[]) => void; onConfirm: () => void; onCancel: () => void }) {
  const { t, lang } = useI18n();
  const count = draft.reduce((n, d) => n + d.items.length, 0);
  const taken = new Set(draft.flatMap((d) => d.items.map((i) => i.pick.place.placeId)));
  const change = (date: string, key: string, next: "swap" | "remove") =>
    setDraft(
      draft
        .map((d) => (d.date !== date ? d : { ...d, items: next === "remove" ? d.items.filter((i) => i.key !== key) : d.items.map((i) => (i.key === key ? swapDraftItem(i, taken) : i)) }))
        .filter((d) => d.items.length),
    );
  return (
    <View style={{ gap: space.section }}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={[textRole.sectionTitle, { color: mono.ink }]}>{t("draft.title")}</Text>
        <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("draft.sub")}</Text>
      </View>
      {draft.map((d) => {
        const note = d.window.arrival !== undefined ? t("draft.arrival", { time: clock(d.window.arrival) }) : d.window.departure !== undefined ? t("draft.departure", { time: clock(d.window.departure) }) : d.area ? t("draft.area", { name: d.area }) : "";
        return (
          <View key={d.date}>
            <SectionHead title={formatDay(lang, d.date)} />
            {!!note && <Text style={[textRole.meta, { color: mono.gray, paddingTop: 8 }]}>{note}</Text>}
            {d.items.map((item) => (
              <View key={item.key} style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: mono.hair }}>
                <Text style={[textRole.itemTitle, { width: 52, fontVariant: ["tabular-nums"], color: mono.ink }]}>{clock(item.start)}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[textRole.itemTitle, { color: mono.ink }]}>{item.pick.place.name}</Text>
                  <Text style={[textRole.meta, { color: mono.gray }]}>{reasonLine(item.pick.reason, lang)}</Text>
                  <View style={{ flexDirection: "row", columnGap: space.gutter }}>
                    {item.alternatives.some((p) => !taken.has(p.place.placeId)) && <TextLink tone="dismiss" title={t("draft.swap")} label={t("draft.swapA11y", { name: item.pick.place.name })} onPress={() => change(d.date, item.key, "swap")} />}
                    <TextLink tone="dismiss" title={t("draft.remove")} label={t("draft.removeA11y", { name: item.pick.place.name })} onPress={() => change(d.date, item.key, "remove")} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        );
      })}
      <GoogleMapsAttribution />
      <View style={{ gap: 4 }}>
        <SolidButton title={t("draft.confirm", { n: count })} disabled={!count} onPress={onConfirm} />
        <TextLink tone="dismiss" title={t("draft.cancel")} onPress={onCancel} />
      </View>
    </View>
  );
}
