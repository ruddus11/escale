import { TripPhotoThumb } from "./TripPhotoThumb";
import type { DayPhoto } from "../data/photoDays";
import { Pressable, Text, View } from "react-native";
import type { Reservation } from "../../../src/domain/reservations/types";
import { zonedDate } from "../../../src/domain/time/zoned";
import type { PageEntry } from "../data/model";
import { airportArrival, airportLabel } from "../data/airportTime";
import { clock } from "../data/dayPlan";
import type { OverviewItem, OverviewStay } from "../data/overviewItems";
import { zoneCity } from "../data/selectionOptions";
import { useI18n } from "../i18n/I18n";
import { formatDay } from "../i18n/strings";
import { Chevron } from "../theme/mono";
import { mono, scrapbook, textRole } from "../theme/tokens";

export function NowNextBookings({ photos = [], items, now, timeZone, onOpen, onOpenPage, onOpenPlan }: {
  photos?: DayPhoto[]; items: OverviewItem[]; now: Date; timeZone: string; onOpen: (reservation: Reservation) => void; onOpenPage?: (page: PageEntry) => void; onOpenPlan?: () => void;
}) {
  const { t, lang } = useI18n();
  return <View>
    {items.map((entry, index) => {
      const flight = entry.kind === "flight" ? entry.reservation : undefined;
      const schedule = entry.kind === "schedule" ? entry.item : undefined;
      const reservation = schedule && "reservation" in schedule ? schedule.reservation : flight;
      const date = flight?.startDate;
      const day = flight && date ? (date === zonedDate(now, flight.timeZone) ? t("overview.today") : formatDay(lang, date)) : "";
      const scheduleDate = schedule?.startAt === undefined ? "" : zonedDate(new Date(schedule.startAt), schedule.timeZone || timeZone);
      const scheduleDay = scheduleDate ? (scheduleDate === zonedDate(now, schedule?.timeZone || timeZone) ? t("overview.today") : formatDay(lang, scheduleDate)) : "";
      const airport = airportLabel(flight?.departure, lang);
      const departure = airport?.replace(/공항$/, "");
      const destination = airportLabel(flight?.arrival, lang)?.replace(/공항$/, "");
      const title = flight ? [day, flight.startTime, departure && destination ? `${departure}→${destination}` : flight.title].filter(Boolean).join(" ")
        : schedule ? [scheduleDay, schedule.start === undefined ? "" : clock(schedule.start), schedule.title].filter(Boolean).join(" ") : "";
      const arrival = flight && index === 0 ? airportArrival(flight) : undefined;
      const arrivalText = arrival?.arriveTime && airport
        ? t("overview.airportBy", { time: [arrival.arriveDate !== flight?.startDate ? formatDay(lang, arrival.arriveDate!) : "", arrival.arriveTime].filter(Boolean).join(" "), airport, zone: zoneCity(arrival.timeZone, lang) }) : "";
      const onPress = reservation ? () => onOpen(reservation) : schedule?.kind === "plan" && onOpenPage ? () => onOpenPage(schedule.page) : onOpenPlan;
      return <Pressable key={flight?.id ?? schedule?.id} accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={[t(index === 0 ? "overview.now" : "overview.next"), title, arrivalText].filter(Boolean).join(", ")}
        disabled={!onPress} onPress={onPress}
        style={({ pressed }) => ({ minHeight: index === 0 ? 140 : 52, padding: index === 0 ? 18 : 12, marginTop: 10, backgroundColor: index === 0 ? scrapbook.blush : scrapbook.lime, borderWidth: 1, borderColor: mono.hair, opacity: pressed ? .65 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TripPhotoThumb photos={photos} date={flight?.startDate ?? scheduleDate} planId={schedule?.kind === "plan" ? schedule.page.id : undefined} placeId={schedule?.kind === "plan" ? schedule.page.placeId : undefined} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[textRole.label, { color: index === 0 ? scrapbook.blue : mono.gray }]}>{t(index === 0 ? "overview.now" : "overview.next")}{index === 0 ? ` · ${flight ? day : scheduleDay}` : ""}</Text>
            {index === 0 && <Text style={[textRole.feature, { color: mono.ink }]}>{flight?.startTime ?? (schedule?.start === undefined ? "—" : clock(schedule.start))}</Text>}
            <Text lineBreakStrategyIOS="hangul-word" style={[textRole.itemTitle, { color: mono.ink }]}>{index === 0 ? (flight ? (departure && destination ? `${departure} → ${destination}` : flight.title) : schedule?.title) : title}</Text>
          </View>
          {!!onPress && <Chevron />}
        </View>
        {!!arrivalText && <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray, marginTop: 8 }]}>{arrivalText}</Text>}
      </Pressable>;
    })}
  </View>;
}

export function StayLine({ photos = [], shown: { stay, when }, onOpen }: { photos?: DayPhoto[]; shown: OverviewStay; onOpen: (reservation: Reservation) => void }) {
  const { t, lang } = useI18n();
  // 퇴실하는 날의 이전 숙소에는 "오늘 밤"이나 지난 체크인 시각 대신 체크아웃을 보여 준다.
  const title = (when === "checkout"
    ? [t("overview.today"), stay.title, [t("pouch.checkOut"), stay.endTime].filter(Boolean).join(" ")]
    : [when === "tonight" ? t("overview.tonight") : formatDay(lang, stay.startDate), stay.title, stay.startTime ? `${t("pouch.checkIn")} ${stay.startTime}` : ""]).filter(Boolean).join(" · ");
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t("res.kind.stay")}, ${title}`} onPress={() => onOpen(stay)}
    style={({ pressed }) => ({ minHeight: 52, paddingVertical: 12, borderBottomWidth: 1, borderColor: mono.hair, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? .65 : 1 })}>
    <TripPhotoThumb photos={photos} date={stay.startDate} />
    <Text lineBreakStrategyIOS="hangul-word" style={[textRole.itemTitle, { color: mono.ink, flex: 1 }]}>{title}</Text><Chevron />
  </Pressable>;
}
