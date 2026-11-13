import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import { CURRENCY_DIGITS, formatMoney } from "../../../src/domain/money/currency";
import type { PackingItem, PageEntry } from "../data/model";
import { clock, nextUp, timeZoneLabel, todayPlan, type TimelineItem } from "../data/dayPlan";
import { TodayHero } from "../components/TodayHero";
import { expenseGroups, notebookDay, todaySpending } from "../data/notebookView";
import { directionsFromHere } from "../data/routes";
import { fetchRate, type LiveRate } from "../data/rates";
import { loadWeather } from "../data/todayServices";
import { weatherKind, type CityWeather } from "../data/travelToday";
import { formatShort } from "../data/budgetPlan";
import { useI18n } from "../i18n/I18n";
import { formatDay, type Key } from "../i18n/strings";
import { Bar, Card, Chevron, Icon, SectionHead, SolidButton, LineButton, TextLink } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";

// 오늘 탭. 위에서부터 JEV의 한마디 → 다음 일정(길찾기) → 날씨·환율 → 오늘 쓴 돈 → 오늘 남은 일정.
// 여행 전에는 출발까지의 준비, 여행 후에는 쓴 돈과 다녀온 곳을 보인다.
export function TodayPage({
  trip,
  pages,
  packing,
  now,
  saving,
  openPage,
  openReservation,
  openPlan,
  openMoney,
  openPacking,
  expense,
  setPlaceDone,
}: {
  trip: TripWorkspace;
  pages: PageEntry[];
  packing: PackingItem[];
  now: Date;
  saving: boolean;
  openPage: (p: PageEntry) => void;
  openReservation: (r: Reservation) => void;
  openPlan: () => void;
  openMoney: () => void;
  openPacking: () => void;
  expense: () => void;
  setPlaceDone: (page: PageEntry, done: boolean) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const day = notebookDay(trip.settings, now);
  const plan = todayPlan(trip, pages, now, lang);
  const next = day.phase === "during" ? nextUp(plan, now) : undefined;
  const later = day.phase === "during" ? plan.timed.filter((item) => item !== next && !item.done && (item.startAt ?? 0) > now.getTime()) : [];
  const { spent, dailyBudget } = todaySpending(trip, day.today);
  const packedDone = packing.filter((p) => p.done).length;
  const status = day.phase === "before" ? (day.until ? t("now.before", { n: day.until }) : t("now.beforeToday")) : day.phase === "during" ? t("now.during", { n: day.day, total: day.total }) : t("now.after");
  const base = trip.settings.baseCurrency;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 40, gap: space.section }}>
      <TodayHero tripId={trip.id} title={trip.settings.title} startDate={trip.settings.startDate} endDate={trip.settings.endDate} status={status} />
      {day.phase === "during" && <Text numberOfLines={1} style={[textRole.sectionTitle, { color: mono.ink, marginBottom: -8 }]}>{formatDay(lang, day.today)}</Text>}

      {day.phase === "during" && (next ? <NextCard item={next} trip={trip} now={now} saving={saving} openPage={openPage} openReservation={openReservation} setPlaceDone={setPlaceDone} /> : null)}

      {day.phase !== "after" && <WeatherAndRate trip={trip} />}

      {day.phase === "during" && (
        <Card onPress={openMoney} label={`${t("now.spent")} ${formatMoney(spent, base)}`}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.spent")}</Text>
            <Chevron />
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <Text style={[textRole.feature, { color: dailyBudget && spent > dailyBudget ? mono.warn : mono.ink }]}>{formatMoney(spent, base)}</Text>
            {!!dailyBudget && <Text style={[textRole.meta, { color: mono.gray }]}>/ {formatMoney(dailyBudget, base)}</Text>}
          </View>
          {dailyBudget ? <Bar ratio={spent / dailyBudget} color={spent > dailyBudget ? mono.warn : mono.accent} /> : <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.noBudget")}</Text>}
          <SolidButton icon="plus" title={t("now.addExpense")} disabled={saving} onPress={expense} style={{ minHeight: 44, marginTop: 4 }} />
        </Card>
      )}

      {!!later.length && (
        <View>
          <SectionHead title={t("now.rest")} right={<TextLink title={t("tab.plan")} onPress={openPlan} />} />
          {later.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => (item.kind === "plan" ? openPage(item.page) : "reservation" in item ? openReservation(item.reservation) : undefined)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}>
              <Text style={[textRole.itemTitle, { width: 52, fontVariant: ["tabular-nums"], color: mono.ink }]}>{item.start !== undefined ? clock(item.start) : ""}</Text>
              <Text numberOfLines={1} style={[textRole.itemTitle, { flex: 1, color: mono.ink }]}>{item.title}</Text>
              <Chevron />
            </Pressable>
          ))}
        </View>
      )}

      {day.phase === "before" && (
        <View style={{ flexDirection: "row", gap: space.group }}>
          <Card onPress={openPacking} label={t("now.packing")} style={{ flex: 1 }}>
            <Icon name="check" size={20} color={mono.accent} />
            <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.packing")}</Text>
            <Text style={[textRole.itemTitle, { color: mono.ink, fontVariant: ["tabular-nums"] }]}>{t("now.packingProgress", { done: packedDone, n: packing.length })}</Text>
          </Card>
          <Card onPress={openPlan} label={t("planv.bookings")} style={{ flex: 1 }}>
            <Icon name="ticket" size={20} color={mono.accent} />
            <Text style={[textRole.meta, { color: mono.gray }]}>{t("planv.bookings")}</Text>
            <Text style={[textRole.itemTitle, { color: mono.ink, fontVariant: ["tabular-nums"] }]}>{t("now.bookings", { n: (trip.reservations ?? []).length })}</Text>
          </Card>
        </View>
      )}

      {day.phase === "after" && (
        <View style={{ flexDirection: "row", gap: space.group }}>
          <Card onPress={openMoney} label={t("now.totalSpent")} style={{ flex: 1 }}>
            <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.totalSpent")}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[textRole.pageTitle, { color: mono.ink, fontVariant: ["tabular-nums"] }]}>{formatMoney(expenseGroups(trip).reduce((sum, g) => sum + g.total, 0), base)}</Text>
          </Card>
          <Card onPress={openPlan} label={t("now.visitedCount")} style={{ flex: 1 }}>
            <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.visitedCount")}</Text>
            <Text style={[textRole.pageTitle, { color: mono.ink, fontVariant: ["tabular-nums"] }]}>{pages.filter((p) => p.kind === "plan" && p.done).length}</Text>
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

function destinationOf(item: TimelineItem): string {
  if (item.kind === "plan") return item.page.address.trim() || item.title;
  if (item.kind === "booking") return item.reservation.address?.trim() || item.title;
  if (item.kind === "move") return item.reservation.departure?.trim() || "";
  return "";
}

/** 다음 일정 한 장. 시각·이름·장소와 길찾기, 계획이면 "다녀왔어요". */
function NextCard({ item, trip, now, saving, openPage, openReservation, setPlaceDone }: { item: TimelineItem; trip: TripWorkspace; now: Date; saving: boolean; openPage: (p: PageEntry) => void; openReservation: (r: Reservation) => void; setPlaceDone: (page: PageEntry, done: boolean) => Promise<void> }) {
  const { t, lang } = useI18n();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const live = (item.startAt ?? 0) <= now.getTime();
  const time = item.start !== undefined ? (item.end !== undefined && item.end !== item.start ? `${clock(item.start)} – ${clock(item.end)}` : clock(item.start)) : "";
  const zone = timeZoneLabel(item, trip.settings.timeZone, lang);
  const place = item.kind === "plan" ? item.page.address : item.kind === "booking" ? item.reservation.address ?? "" : item.detail;
  const target = destinationOf(item);
  const open = item.kind === "plan" ? () => openPage(item.page) : "reservation" in item ? () => openReservation(item.reservation) : undefined;
  return (
    <Card style={{ gap: 12 }}>
      <Pressable accessibilityRole="button" disabled={!open} onPress={open} style={({ pressed }) => ({ gap: 6, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[textRole.label, { color: live ? mono.coralText : mono.accentText }]}>{t(live ? "now.current" : "now.next")}</Text>
          {open && <Chevron />}
        </View>
        {!!time && <Text style={[textRole.feature, { color: mono.ink }]}>{time}</Text>}
        {!!zone && <Text style={[textRole.meta, { color: mono.gray }]}>{zone}</Text>}
        <Text numberOfLines={2} style={[textRole.pageTitle, { color: mono.ink }]}>{item.title}</Text>
        {!!place && <Text numberOfLines={2} style={[textRole.meta, { color: mono.gray }]}>{place}</Text>}
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!!target && (
          <SolidButton
            icon="route"
            title={t("now.directions")}
            style={{ flex: 1, minHeight: 44 }}
            onPress={() => {
              setFailed(false);
              Linking.openURL(directionsFromHere(target)).catch(() => setFailed(true));
            }}
          />
        )}
        {item.kind === "plan" && (
          <LineButton
            icon="check"
            title={t("now.visited")}
            disabled={saving || busy}
            style={{ flex: 1, minHeight: 44 }}
            onPress={() => {
              setBusy(true);
              void setPlaceDone(item.page, true).finally(() => setBusy(false));
            }}
          />
        )}
      </View>
      {failed && <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.warn }]}>{t("now.directionsFailed")}</Text>}
    </Card>
  );
}

/** 날씨(여행지 이름으로 Open-Meteo)와 환율(현지 → 정산 통화, Frankfurter). 실패하면 그렇게 알린다. */
function WeatherAndRate({ trip }: { trip: TripWorkspace }) {
  const { t } = useI18n();
  const destination = trip.settings.destination?.trim() ?? "";
  const local = trip.settings.localCurrency, base = trip.settings.baseCurrency;
  const [weather, setWeather] = useState<{ value: CityWeather | null; cached: boolean } | "loading">("loading");
  const [retry, setRetry] = useState(0);
  const [rate, setRate] = useState<LiveRate | null | "loading">("loading");
  useEffect(() => {
    let alive = true;
    setWeather("loading");
    if (!destination) setWeather({ value: null, cached: false });
    else void loadWeather(destination).then((v) => alive && setWeather(v), () => alive && setWeather({ value: null, cached: true }));
    return () => {
      alive = false;
    };
  }, [destination, retry]);
  useEffect(() => {
    let alive = true;
    setRate("loading");
    if (local === base) setRate(null);
    else void fetchRate(local, base).then((v) => alive && setRate(v ?? null), () => alive && setRate(null));
    return () => {
      alive = false;
    };
  }, [local, base]);
  // 엔화처럼 단위가 작은 통화는 100단위로 보여 준다(100엔 = 912원).
  const unit = rate && rate !== "loading" && Number(rate.rate) < 10 ? 100 : 1;
  return (
    <View style={{ flexDirection: "row", gap: space.group }}>
      <Card style={{ flex: 1, gap: 6 }}>
        <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.weather")}</Text>
        {weather === "loading" ? (
          <ActivityIndicator color={mono.gray} style={{ alignSelf: "flex-start" }} />
        ) : weather.value ? (
          <>
            <Text style={[textRole.pageTitle, { color: mono.ink, fontVariant: ["tabular-nums"] }]}>{`${Math.round(weather.value.temperature)}°`}</Text>
            <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray }]}>
              {[t(`weather.${weatherKind(weather.value.code)}` as Key), weather.cached ? t("now.weatherCached", { time: weather.value.at.slice(11, 16) }) : destination].filter(Boolean).join(" · ")}
            </Text>
          </>
        ) : (
          <>
            <Text style={[textRole.meta, { color: mono.gray }]}>{destination ? t("now.weatherFailed") : t("now.weatherNone")}</Text>
            {!!destination && <TextLink title={t("now.retry")} onPress={() => setRetry((n) => n + 1)} style={{ minHeight: 32 }} />}
          </>
        )}
      </Card>
      <Card style={{ flex: 1, gap: 6 }}>
        <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.rate")}</Text>
        {local === base ? (
          <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.rateSame")}</Text>
        ) : rate === "loading" ? (
          <ActivityIndicator color={mono.gray} style={{ alignSelf: "flex-start" }} />
        ) : rate ? (
          <>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[textRole.pageTitle, { color: mono.ink, fontVariant: ["tabular-nums"] }]}>{formatShort(Math.round(Number(rate.rate) * unit * 10 ** CURRENCY_DIGITS[base]), base)}</Text>
            <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray }]}>{`${unit} ${local} · ${t("now.rateDate", { date: rate.date.slice(5).replace("-", ".") })}`}</Text>
          </>
        ) : (
          <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.rateFailed")}</Text>
        )}
      </Card>
    </View>
  );
}
