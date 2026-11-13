import { DayRoute } from "../components/DayRoute";
import { useDayPhotos } from "../data/dayPhotoStore";
import { TripPhotoThumb } from "../components/TripPhotoThumb";
import type { DayPhoto } from "../data/photoDays";
import { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import { sortedReservations } from "../../../src/domain/reservations/reservations";
import type { PageEntry } from "../data/model";
import { notebookDay, reservationSummary } from "../data/notebookView";
import { clock, dayCounts, dayPlan, mapTargets, stayEvents, timeZoneLabel, toMinutes, tripDays, type TimelineItem, type TimelineLink } from "../data/dayPlan";
import { localDateTime } from "../../../src/domain/time/zoned";
import { zoneCity } from "../data/selectionOptions";
import { useLocatedTargets } from "../components/DayMap";
import { RouteLeg, Stem } from "../components/RouteLeg";
import { DayStrip } from "../components/DayStrip";
import { PlanCalendar } from "../components/PlanCalendar";
import { BookingAutofillCard } from "../components/BookingAutofill";
import { autofillId, type Suggestion } from "../data/bookingAutofill";
import { routeLegs } from "../data/routes";
import { isPickedLine } from "../data/pickedLine";
import { reservationKindKey } from "./Reservations";
import { useI18n } from "../i18n/I18n";
import { formatDay, formatDuration } from "../i18n/strings";
import { Card, Check, Chevron, EmptyState, Icon, LineButton, SectionHead, Segmented, Tag, TextLink, type IconName } from "../theme/mono";
import { timelineColumns } from "../theme/textScale";
import { diary, mono, radius, space, textRole } from "../theme/tokens";

export type PlanView = "times" | "calendar" | "map" | "bookings";

// 계획 탭. 시간표·캘린더·지도·예약 네 보기가 같은 고른 날짜를 쓴다.
// 고른 날짜는 App이 들고 있어 다른 탭에 다녀와도 그대로다.
export function PlanPage({
  trip,
  pages,
  now,
  date: picked,
  setDate,
  view,
  setView,
  newPlan,
  newPlace,
  openPage,
  openReservation,
  onAddReservation,
  openPicks,
  onSignIn,
  saving = false,
  applyAutofill,
}: {
  trip: TripWorkspace;
  pages: PageEntry[];
  now: Date;
  date: string | undefined;
  setDate: (date: string) => void;
  view: PlanView;
  setView: (view: PlanView) => void;
  newPlan: (preset: { date: string; time?: string }) => void;
  newPlace: () => void;
  openPage: (p: PageEntry) => void;
  openReservation: (r: Reservation) => void;
  onAddReservation: (date?: string) => void;
  openPicks: () => void;
  /** 로그인 화면으로 갈 수 있을 때만 넘긴다. 지도 자리의 로그인 안내에 쓴다. */
  onSignIn?: () => void;
  saving?: boolean;
  /** 예약에서 나온 줄을 계획에 넣거나 시각을 고친다. */
  applyAutofill?: (chosen: Suggestion[]) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const { state: photoState } = useDayPhotos(trip.id);
  const [timeFilter, setTimeFilter] = useState<"all" | "untimed">("all");
  const [dragging, setDragging] = useState(false);
  const days = tripDays(trip.settings, now);
  const { today } = notebookDay(trip.settings, now);
  const fallback = notebookDay(trip.settings, now).date;
  const day = days.find((d) => d.date === (picked ?? fallback)) ?? days.find((d) => d.date === fallback) ?? days[0];
  const date = day.date;
  const counts = dayCounts(trip, pages, days);
  const plan = dayPlan(trip, pages, date, lang);
  // 체크인·아웃을 이미 시간표 줄로 넣었으면 위의 숙소 한 줄은 겹치므로 뺀다.
  const stays = stayEvents(trip.reservations ?? [], date).filter(
    ({ kind, reservation }) => !pages.some((p) => p.id === autofillId(kind, reservation.id) && p.date === date),
  );
  const targets = mapTargets(plan);
  for (const item of [...plan.timed, ...plan.untimed]) {
    if (item.kind === "plan" && !targets.some((x) => x.id === item.id)) targets.push({ id: item.id, title: item.title, open: { kind: "page", page: item.page } });
  }
  const located = useLocatedTargets(targets);
  // 다리의 핀 번호는 지도 핀 번호와 같아야 한다. 지도는 위치를 찾은 곳에만 1부터 차례로 번호를 단다.
  const pins = Object.fromEntries(located.points.map((p, i) => [p.id, i + 1]));
  const legs = routeLegs(
    plan.timed,
    Object.fromEntries(located.points.map((p) => [p.id, p])),
    Object.fromEntries(targets.flatMap((target) => (target.address ? [[target.id, target.address]] : []))),
  );
  const saved = pages.filter((p) => p.kind === "place" && !p.done);
  const reservations = sortedReservations(trip.reservations ?? []);

  function open(item: TimelineItem) {
    if (item.kind === "plan") openPage(item.page);
    else if (item.kind === "move" || item.kind === "booking" || item.kind === "arrive") openReservation(item.reservation);
  }
  const views: { key: PlanView; title: string; icon: IconName }[] = [
    { key: "times", title: t("planv.times"), icon: "list" },
    { key: "calendar", title: t("planv.calendar"), icon: "calendar" },
    { key: "map", title: t("planv.map"), icon: "pin" },
    { key: "bookings", title: t("planv.bookings"), icon: "ticket" },
  ];
  const dayHead = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text style={[textRole.sectionTitle, { flexShrink: 1, color: mono.ink }]}>{`${t("plan.dayN", { n: day.index })} · ${formatDay(lang, date)}`}</Text>
      <TextLink icon="plus" title={t("planv.addPlan")} disabled={saving} onPress={() => newPlan({ date })} />
    </View>
  );

  return (
    <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 40, gap: space.section }}>
      <Segmented items={views} value={view} onChange={setView} label={t("planv.label")} />
      {(view === "times" || view === "map" || view === "bookings") && (
        <DayStrip days={days} selected={date} today={today} counts={counts} label={(d) => t("plan.dayA11y", { n: d.index, date: formatDay(lang, d.date), count: counts[d.date] })} onSelect={setDate} />
      )}

      {view === "times" && (
        <View style={{ gap: space.group }}>
          {dayHead}
          <Segmented items={[{ key: "all", title: t("planv.allTimes") }, { key: "untimed", title: t("planv.untimed") }]} value={timeFilter} onChange={setTimeFilter} label={t("planv.timeFilter")} />
          {timeFilter === "all" && <>
          {applyAutofill && <BookingAutofillCard trip={trip} pages={pages} compact saving={saving} onApply={applyAutofill} />}
          {/* 체크아웃은 하루를 열고 체크인은 하루를 닫으니, 체크아웃은 시간표 위에, 체크인은 시간표 아래에 둔다. */}
          <StayLines photos={photoState.photos} stays={stays.filter((x) => x.kind === "checkOut")} onOpen={openReservation} />
          <View>
            {plan.timed.map((item, i) => (
              <View key={item.id}>
                <Line photos={photoState.photos} item={item} tripZone={trip.settings.timeZone} onPress={() => open(item)} />
                {i < plan.links.length && <Link link={plan.links[i]} from={linkStartMinutes(item, trip.settings.timeZone, date)} onAdd={(minutes) => newPlan({ date, time: clock(minutes) })} />}
                {legs[i] && (
                  <RouteLeg
                    key={`${legs[i]!.from.id}-${legs[i]!.to.id}`}
                    fromTitle={item.title}
                    toTitle={legs[i]!.to.title}
                    origin={legs[i]!.origin}
                    destination={legs[i]!.destination}
                    fromPin={pins[legs[i]!.from.id]}
                    toPin={pins[legs[i]!.to.id]}
                  />
                )}
              </View>
            ))}
            {!plan.timed.length && !plan.untimed.length && <EmptyState text={t("planv.dayEmpty")} action={{ title: t("planv.addPlan"), icon: "plus", onPress: () => newPlan({ date }), disabled: saving }} />}
          </View>
          <StayLines photos={photoState.photos} stays={stays.filter((x) => x.kind === "checkIn")} onOpen={openReservation} />
          </>}
          {timeFilter === "untimed" && !plan.untimed.length && <EmptyState text={t("planv.noUntimed")} action={{ title: t("planv.addPlan"), icon: "plus", onPress: () => newPlan({ date }), disabled: saving }} />}
          {!!plan.untimed.length && <Untimed items={plan.untimed} photos={photoState.photos} date={date} onOpen={open} />}
        </View>
      )}

      {view === "calendar" && (
        <View style={{ gap: space.section }}>
          <PlanCalendar start={trip.settings.startDate} end={days[days.length - 1].date} selected={date} today={today} counts={counts} onSelect={setDate} />
          <Card style={{ gap: 8 }}>
            {dayHead}
            {[...plan.timed, ...plan.untimed].length ? (
              [...plan.timed, ...plan.untimed].map((item) => (
                <Pressable key={item.id} accessibilityRole="button" onPress={() => open(item)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={[textRole.meta, { width: 48, fontVariant: ["tabular-nums"], color: mono.gray }]}>{item.start !== undefined ? clock(item.start) : "—"}</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: railColor(item) }} />
                  <Text numberOfLines={1} style={[textRole.itemTitle, { flex: 1, color: item.done ? mono.gray : mono.ink }]}>{item.title}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={[textRole.meta, { color: mono.gray }]}>{t("planv.dayEmpty")}</Text>
            )}
            <TextLink title={t("planv.openTimes")} onPress={() => setView("times")} style={{ alignSelf: "flex-start" }} />
          </Card>
        </View>
      )}

      {view === "map" && (
        <View style={{ gap: space.section }}>
          <DayRoute key={`${trip.id}:${date}`} tripId={trip.id} date={date} targets={targets} located={located} onSignIn={onSignIn} onGesture={setDragging} onOpen={(target) => (target.open.kind === "page" ? openPage(target.open.page) : openReservation(target.open.reservation))} />
          <View style={{ gap: 4 }}>
            <SectionHead title={t("planv.saved")} right={<TextLink icon="plus" title={t("planv.addPlace")} disabled={saving} onPress={newPlace} />} />
            {saved.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={[p.title, p.address].filter(Boolean).join(", ")} onPress={() => openPage(p)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}>
                <Icon name="pin" size={18} color={mono.accent} />
                <View style={{ flex: 1, gap: 2, paddingVertical: 8 }}>
                  <Text numberOfLines={1} style={[textRole.itemTitle, { color: mono.ink }]}>{p.title}</Text>
                  {!!p.address && <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray }]}>{p.address}</Text>}
                </View>
                {isPickedLine(p.body.split("\n")[0]) && <Tag text={t("places.picked")} />}
                <Chevron />
              </Pressable>
            ))}
            {!saved.length && <EmptyState text={t("planv.savedEmpty")} />}
            <LineButton icon="search" title={t("planv.findPlaces")} onPress={openPicks} style={{ marginTop: space.group }} />
          </View>
        </View>
      )}

      {view === "bookings" && (
        <View style={{ gap: space.group }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[textRole.sectionTitle, { color: mono.ink }]}>{t("now.bookings", { n: reservations.length })}</Text>
            <TextLink icon="plus" title={t("planv.addBooking")} disabled={saving} onPress={() => onAddReservation(date)} />
          </View>
          {reservations.map((r) => {
            const onDay = r.startDate <= date && (r.endDate ?? r.startDate) >= date;
            return (
              <Card key={r.id} onPress={() => openReservation(r)} label={r.title} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: onDay ? 1 : 0, borderColor: mono.accent }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.control, backgroundColor: mono.bg, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={r.kind === "stay" ? "bed" : r.kind === "activity" ? "ticket" : r.kind === "flight" ? "plane" : "route"} size={20} color={mono.accent} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[textRole.label, { color: mono.gray }]}>{t(reservationKindKey[r.kind])}</Text>
                    {onDay && <Tag text={t("planv.onDay")} solid />}
                  </View>
                  <Text numberOfLines={1} style={[textRole.itemTitle, { color: mono.ink }]}>{r.title}</Text>
                  <Text numberOfLines={2} style={[textRole.meta, { color: mono.gray }]}>{reservationSummary(r, lang)}</Text>
                </View>
                <Chevron />
              </Card>
            );
          })}
          {!reservations.length && <EmptyState text={t("planv.bookingsEmpty")} action={{ title: t("planv.addBooking"), icon: "plus", onPress: () => onAddReservation(date), disabled: saving }} />}
        </View>
      )}
    </ScrollView>
  );
}

function Untimed({ items, photos, date, onOpen }: { items: TimelineItem[]; photos: DayPhoto[]; date: string; onOpen: (item: TimelineItem) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ marginTop: space.group }}>
      <SectionHead title={t("planv.untimed")} />
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onOpen(item)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
        >
          <TripPhotoThumb photos={photos} date={date} planId={item.kind === "plan" ? item.page.id : undefined} placeId={item.kind === "plan" ? item.page.placeId : undefined} />
          <Check done={item.done} size={18} />
          <Text style={[textRole.itemTitle, { flex: 1, color: item.done ? mono.gray : mono.ink, textDecorationLine: item.done ? "line-through" : "none" }]}>{item.title}</Text>
          {!!item.detail && (
            <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray, maxWidth: "45%" }]}>
              {item.detail}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** 일정표 줄 왼쪽의 색 막대. 종류를 글자보다 먼저 보이게 한다: 계획은 딥 틸, 이동은 산호, 예약은 회청색. */
function railColor(item: TimelineItem): string {
  if (item.kind === "move" || item.kind === "arrive") return mono.coral;
  if (item.kind === "booking") return "#7D8B99";
  return item.done ? diary.edge : mono.accent;
}

function StayLines({ photos, stays, onOpen }: { photos: DayPhoto[]; stays: ReturnType<typeof stayEvents>; onOpen: (r: Reservation) => void }) {
  const { t } = useI18n();
  if (!stays.length) return null;
  return (
    <View>
      {stays.map(({ kind, reservation: r, time }) => (
        <Pressable key={`${kind}-${r.id}`} accessibilityRole="button" onPress={() => onOpen(r)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, opacity: pressed ? 0.6 : 1 })}>
          <TripPhotoThumb photos={photos} date={r.startDate} />
          <Text style={[textRole.meta, { color: mono.gray }]}>{[t(kind === "checkIn" ? "pouch.checkIn" : "pouch.checkOut"), time].filter(Boolean).join(" ")}</Text>
          <Text numberOfLines={1} style={[textRole.itemTitle, { flex: 1, color: mono.ink }]}>{r.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// 시각 칸. 너비와 세로선 위치는 글씨 배율에 따라 timelineColumns가 함께 정한다.
const timeStyle = { ...textRole.itemTitle, fontVariant: ["tabular-nums" as const] };

// 다른 시간대 예약 뒤에 계획을 넣을 때는 여행 날짜의 현지 시각으로 바꾼다.
function linkStartMinutes(item: TimelineItem, tripZone: string, date: string): number | undefined {
  if (item.endAt === undefined) return undefined;
  const local = localDateTime(new Date(item.endAt), tripZone);
  return local.slice(0, 10) === date ? toMinutes(local.slice(11, 16)) : undefined;
}

/** 시간표 한 줄. 시각·체크·제목. 이동편은 체크 대신 빈 자리를 두고 도착 시각을 오른쪽에 적는다. */
function Line({ photos, item, tripZone, onPress }: { photos: DayPhoto[]; item: TimelineItem; tripZone: string; onPress: () => void }) {
  const { t, lang } = useI18n();
  const time = item.start !== undefined ? clock(item.start) : "";
  const zone = timeZoneLabel(item, tripZone, lang);
  const tappable = item.kind !== "imported";
  // 큰 글씨에서는 시각을 제목 위 한 줄로 올리고, 제목 옆 도착·소요 시간도 제목 아래로 내린다.
  const { fontScale, width } = useWindowDimensions();
  const { stacked, timeWidth } = timelineColumns(fontScale, width);
  const rowStyle = { flexDirection: stacked ? ("column" as const) : ("row" as const), alignItems: stacked ? ("stretch" as const) : ("flex-start" as const), gap: stacked ? 4 : 12, paddingVertical: 10 };
  const timeText = (done?: boolean) => (stacked && !time ? null : <Text style={[timeStyle, stacked ? null : { width: timeWidth }, { color: done ? mono.gray : mono.ink }]}>{time}</Text>);
  const bodyRow = { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 12, ...(stacked ? null : { flex: 1 }) };
  const titleRow = stacked ? { gap: 4 } : { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 };
  const titleFlex = stacked ? null : { flex: 1 };
  if (item.kind === "move")
    // 다음 이동표는 여행 도구가 크게 보여 주니 여기서는 다른 줄과 같은 크기로 둔다.
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({ ...rowStyle, opacity: pressed ? 0.6 : 1 })}
      >
        {timeText()}
        <View style={bodyRow}>
          <View style={{ width: 3, alignSelf: "stretch", backgroundColor: railColor(item) }} />
          <TripPhotoThumb photos={photos} date={item.reservation.startDate} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={titleRow}>
              <Text style={[textRole.itemTitle, titleFlex, { color: mono.ink }]}>{item.title}</Text>
              {/* 도착 도시 이름이 길어도 제목을 밀어내지 않도록 절반까지만 쓰고 줄을 바꾼다. */}
              <Tag text={t("overview.transport")} />
              {!!item.endLabel && <Text style={[textRole.meta, stacked ? null : { maxWidth: "50%", textAlign: "right" }, { fontVariant: ["tabular-nums"], color: mono.gray }]}>{`${t("res.arrive")} ${item.endLabel}${item.reservation.endTimeZone && item.reservation.endTimeZone !== tripZone ? ` · ${zoneCity(item.reservation.endTimeZone, lang)}` : ""}`}</Text>}
            </View>
            {!!zone && <Text style={[textRole.meta, { color: mono.gray }]}>{zone}</Text>}
            {!!item.detail && (
              <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray }]}>
                {item.detail}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  return (
    <Pressable
      accessibilityRole={tappable ? "button" : undefined}
      disabled={!tappable}
      onPress={onPress}
      style={({ pressed }) => ({ ...rowStyle, opacity: pressed ? 0.6 : 1 })}
    >
      {timeText(item.done)}
      {!stacked && <View style={{ width: 3, alignSelf: "stretch", backgroundColor: railColor(item) }} />}
      <TripPhotoThumb photos={photos} date={item.kind === "plan" ? item.page.date : "reservation" in item ? item.reservation.startDate : ""} planId={item.kind === "plan" ? item.page.id : undefined} placeId={item.kind === "plan" ? item.page.placeId : undefined} />
      <View style={bodyRow}>
        <View style={{ marginTop: 3 }}>
          <Check done={item.done} size={18} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={titleRow}>
            <Text style={[textRole.itemTitle, titleFlex, { color: item.done ? mono.gray : mono.ink, textDecorationLine: item.done ? "line-through" : "none" }]}>
              {item.title}
            </Text>
            {item.kind === "plan" && item.end !== undefined && item.start !== undefined && (
              <Text style={[textRole.meta, { color: mono.gray }]}>{formatDuration(lang, item.end - item.start)}</Text>
            )}
          </View>
          {!!zone && <Text style={[textRole.meta, { color: mono.gray }]}>{zone}</Text>}
          {(!!item.detail || item.kind === "booking") && (
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {item.kind === "booking" && <Tag text={t("plan.booked")} solid />}
              {!!item.detail && (
                <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray, flexShrink: 1 }]}>
                  {item.detail}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// 두 줄 사이. 빈 시간은 읽는 정보로 두고, 그 시각에서 바로 넣는 보조 행동은 길게 누를 때만 연다.
function Link({ link, from, onAdd }: { link: TimelineLink | null; from?: number; onAdd: (minutes: number) => void }) {
  const { t, lang } = useI18n();
  const { fontScale, width } = useWindowDimensions();
  const { railInset } = timelineColumns(fontScale, width);
  const stem = <Stem />;
  if (!link) return <View style={{ flexDirection: "row", paddingLeft: railInset, height: 10 }}>{stem}</View>;
  if (link.kind === "gap") {
    const free = formatDuration(lang, link.minutes);
    if (from === undefined) return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: space.touch, paddingLeft: railInset }}>
        {stem}
        <Text style={[textRole.meta, { flexShrink: 1, color: mono.gray }]}>{t("plan.free", { d: free })}</Text>
      </View>
    );
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("plan.free", { d: free })}
        accessibilityHint={t("plan.freeHint")}
        accessibilityActions={[{ name: "longpress", label: t("plan.add") }]}
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "longpress") onAdd(from); }}
        onLongPress={() => onAdd(from)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: space.touch, paddingLeft: railInset, opacity: pressed ? 0.6 : 1 })}
      >
        {stem}
        <Text style={[textRole.meta, { flexShrink: 1, color: mono.gray }]}>{t("plan.free", { d: free })}</Text>
      </Pressable>
    );
  }
  const d = formatDuration(lang, link.minutes);
  const warn = link.kind === "overlap" || link.tight;
  const text = link.kind === "overlap" ? t("plan.overlap", { d }) : `${t("plan.until", { d })}${link.tight ? ` · ${t("plan.tight")}` : ""}`;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: railInset }}>
      {stem}
      {warn ? (
        <View style={{ flexShrink: 1 }}>
          <Tag text={text} solid />
        </View>
      ) : (
        <Text style={[textRole.meta, { flexShrink: 1, paddingVertical: 4, color: mono.gray }]}>{text}</Text>
      )}
    </View>
  );
}
