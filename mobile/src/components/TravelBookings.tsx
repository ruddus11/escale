import { TripPhotoThumb } from "./TripPhotoThumb";
import { useDayPhotos } from "../data/dayPhotoStore";
import { useState } from "react";
import { Pressable,Text,View,useWindowDimensions } from "react-native";
import type { Reservation } from "../../../src/domain/reservations/types";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { PageEntry } from "../data/model";
import { overviewPlan,overviewStay,pickNowNext } from "../data/overviewItems";
import { notebookDay } from "../data/notebookView";
import { NowNextBookings,StayLine } from "./NowNextBookings";
import { reservationSummary,type Until } from "../data/notebookView";
import { zoneCity } from "../data/selectionOptions";
import { useI18n } from "../i18n/I18n";
import { formatDay,formatUntil } from "../i18n/strings";
import { Chevron,Icon,SectionHead,TextLink } from "../theme/mono";
import { isLargeText } from "../theme/textScale";
import { mono,textRole } from "../theme/tokens";

type BookingAction = { onOpen: (reservation: Reservation) => void };

/** 여행 도구의 항공·숙소 묶음. 확인해 저장한 예약 값으로 표시를 통일한다. 누락된 시각·구간은 추측하지 않는다. */
export function TravelBookings({ trip, pages, now, onOpen, onAdd, disabled, onOpenPage }: BookingAction & {
  trip: TripWorkspace; pages: PageEntry[]; now: Date; onAdd: () => void; disabled?: boolean; onOpenPage: (page: PageEntry) => void;
}) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const { state: photoState } = useDayPhotos(trip.id);
  const reservations = trip.reservations ?? [];
  const stay = overviewStay(reservations, now);
  const items = pickNowNext(reservations, overviewPlan(trip, pages, now, lang), now, notebookDay(trip.settings, now).phase, "j");
  const visibleIds = new Set(items.flatMap((entry) => entry.kind === "flight" ? [entry.reservation.id] : "reservation" in entry.item ? [entry.item.reservation.id] : []));
  if (stay) visibleIds.add(stay.stay.id);
  const remaining = reservations.filter((reservation) => !visibleIds.has(reservation.id));
  const zones = items.flatMap((entry) => entry.kind === "flight" && entry.reservation.endTimeZone && entry.reservation.endTimeZone !== entry.reservation.timeZone ? [entry.reservation] : []);

  return <View style={{ gap: 12 }}>
    {/* 예약 추가는 묶음 제목 오른쪽 한 곳에만 둔다. 추가 화면은 숙소·항공 사진 가져오기부터 연다. */}
    <SectionHead title={t("overview.bookings")} right={<TextLink title={t("overview.addBooking")} disabled={disabled || reservations.length >= 100} onPress={onAdd} />} />
    <NowNextBookings photos={photoState.photos} items={items} now={now} timeZone={trip.settings.timeZone} onOpen={onOpen} onOpenPage={onOpenPage} />
    {stay && <StayLine photos={photoState.photos} shown={stay} onOpen={onOpen} />}
    {!items.length && <Pressable accessibilityRole="button" disabled={disabled || reservations.length >= 100} onPress={onAdd} style={{ minHeight: 44, justifyContent: "center", borderBottomWidth: 1, borderColor: mono.hair }}><Text style={[textRole.itemTitle, { color: mono.ink }]}>{t("overview.addFlightsStay")}</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={expanded ? t("overview.hideDetails") : t("overview.details", { n: remaining.length })}
      onPress={() => setExpanded((value) => !value)} style={({ pressed }) => ({ minHeight: 44, borderBottomWidth: 1, borderColor: mono.hair, flexDirection: "row", alignItems: "center", opacity: pressed ? .65 : 1 })}>
      <Text style={[textRole.meta, { flex: 1, color: mono.gray }]}>{expanded ? t("overview.hideDetails") : t("overview.details", { n: remaining.length })}</Text><Chevron />
    </Pressable>
    {expanded && <View style={{ gap: 8 }}>
      {zones.map((reservation) => <Text key={reservation.id} lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("today.zones", { from: zoneCity(reservation.timeZone, lang), to: zoneCity(reservation.endTimeZone!, lang) })}</Text>)}
      {!!remaining.length && <View>
      <Text style={[textRole.meta,{paddingTop:8,paddingBottom:4,color:mono.gray}]}>{t("overview.otherBookings")}</Text>
      {remaining.map(r=><Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.title}, ${reservationSummary(r,lang)}`} onPress={()=>onOpen(r)} style={({pressed})=>({minHeight:64,paddingVertical:12,gap:6,borderBottomWidth:1,borderColor:mono.hair,opacity:pressed?.6:1})}>
        <View style={{flexDirection:"row",alignItems:"center",gap:12}}><TripPhotoThumb photos={photoState.photos} date={r.startDate} /><Text style={[textRole.itemTitle,{flex:1,color:mono.ink}]}>{r.title}</Text><Chevron /></View>
        <Text style={[textRole.meta,{color:mono.gray}]}>{reservationSummary(r,lang)}</Text>
      </Pressable>)}
      </View>}
      <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("kit.private")}</Text>
    </View>}
  </View>;
}

export function TransportTicket({ reservation: r, until, onOpen, compact=false }: BookingAction & { reservation: Reservation; until?: Until; compact?: boolean }) {
  const { t, lang } = useI18n();
  const crossZone = !!r.endTimeZone && r.endTimeZone !== r.timeZone;
  // 큰 글씨에서는 반 칸에 28pt 시각과 긴 도시 이름이 들어가지 않아 출발 위·도착 아래로 쌓는다.
  const { fontScale, width } = useWindowDimensions();
  const stacked = isLargeText(fontScale, width);
  return <Pressable accessibilityRole="button"
    accessibilityLabel={`${r.title}, ${formatDay(lang, r.startDate)}, ${r.startTime ?? t("res.noTime")}, ${r.endTime ?? t("res.noTime")}`}
    onPress={() => onOpen(r)}
    style={({ pressed }) => ({ backgroundColor: mono.ink, padding: 14, gap: compact?8:10, opacity: pressed ? .8 : 1 })}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}>
      <Text style={[textRole.meta, { color: mono.onInk }]}>{formatDay(lang, r.startDate)}</Text>
      <Text style={[textRole.meta, { color: mono.onInk }]}>{compact ? r.serviceNumber || t("overview.transport") : until ? formatUntil(lang, until) : t("overview.transport")}</Text>
    </View>
    <View style={{ flexDirection: stacked ? "column" : "row", alignItems: stacked ? "flex-start" : "center", gap: 12 }}>
      <View style={stacked ? { gap: 6 } : { flex: 1, gap: 6 }}>
        <Text style={[textRole.pageTitle, { fontVariant: ["tabular-nums"], color: mono.onInk }]}>{r.startTime ?? "—"}</Text>
        <Text style={[textRole.body, { color: mono.onInk }]}>{r.departure || t("res.depart")}</Text>
      </View>
      <Icon name={stacked ? "down" : "chevron"} color={mono.onInk} size={16} />
      <View style={stacked ? { gap: 6 } : { flex: 1, gap: 6, alignItems: "flex-end" }}>
        <Text style={[textRole.pageTitle, { fontVariant: ["tabular-nums"], color: mono.onInk }]}>{r.endTime ?? "—"}</Text>
        <Text style={[textRole.body, { color: mono.onInk, textAlign: stacked ? "left" : "right" }]}>{r.arrival || t("res.arrive")}</Text>
      </View>
    </View>
    {(!compact || !r.departure || !r.arrival) && <Text style={[textRole.meta, { color: mono.onInk }]}>{[r.title, !compact && r.serviceNumber && !r.title.includes(r.serviceNumber) ? r.serviceNumber : undefined].filter(Boolean).join(" · ")}</Text>}
    {!!r.endDate && r.endDate !== r.startDate && <Text style={[textRole.meta, { color: mono.onInk }]}>{t("res.arrive")} · {formatDay(lang, r.endDate)}</Text>}
    {crossZone && <Text style={[textRole.meta, { color: mono.onInk }]}>{t("today.zones", { from: zoneCity(r.timeZone, lang), to: zoneCity(r.endTimeZone!, lang) })}</Text>}
  </Pressable>;
}
