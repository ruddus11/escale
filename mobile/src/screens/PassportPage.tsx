import { useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { PassportState } from "../data/passport";
import { returnDayReached, tripCountries } from "../data/passport";
import { Stamp, countryName } from "../components/Stamp";
import { PassportBook, StampDrop } from "../components/PassportBook";
import { useI18n } from "../i18n/I18n";
import { formatDateRange } from "../i18n/strings";
import { Chevron, LineButton, Seal, SectionHead, SolidButton } from "../theme/mono";
import { mono, radius, space, textRole } from "../theme/tokens";

// 표지 가죽과 사증 면 종이. 출처와 라이선스는 assets/passport/CREDITS.md.
const coverArt = require("../../assets/passport/cover.jpg");
const visaArt = require("../../assets/passport/visa-page.jpg");

/** 여권 탭. 모든 여행에서 받은 도장을 모으고, 아직 귀국하지 않은 여행은 찍힐 도장으로 보인다. */
export function PassportPage({ trips, now, passport, setCancelled, setCompleted, ready, loadError, retryLoad, saveError, retrySave }: { trips: TripWorkspace[]; now: Date; passport: PassportState; saveError: boolean; retrySave: () => void; ready: boolean; loadError: boolean; retryLoad: () => void; setCompleted: (tripId: string, completed: boolean) => Promise<void>; setCancelled: (tripId: string, cancelled: boolean) => Promise<void> }) {
  const { t, lang } = useI18n();
  const [saving, setSaving] = useState(false);
  const pending = trips.filter((trip) => returnDayReached(trip, now) && !passport.cancelled.includes(trip.id) && !passport.completed.includes(trip.id));
  const stamps = [...passport.stamps].reverse();
  const countries = new Set(passport.stamps.map((s) => s.country)).size;
  const cancelled = new Set(passport.cancelled);
  const upcoming = trips.filter((trip) => !returnDayReached(trip, now)).sort((a, b) => a.settings.endDate.localeCompare(b.settings.endDate));
  const cancelledTrips = trips.filter((trip) => cancelled.has(trip.id));

  function confirmCompleted(trip: TripWorkspace) {
    if (saving) return;
    Alert.alert(trip.settings.title, t("passport2.completeBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("passport2.markCancelled"), style: "destructive", onPress: () => saveStatus(() => setCancelled(trip.id, true)) },
      { text: t("passport2.complete"), onPress: () => saveStatus(() => setCompleted(trip.id, true)) },
    ]);
  }

  async function saveStatus(save: () => Promise<void>) {
    setSaving(true);
    try { await save(); } catch { Alert.alert(t("passport2.saveFailed")); } finally { setSaving(false); }
  }

  function toggleCancelled(trip: TripWorkspace) {
    const on = cancelled.has(trip.id);
    Alert.alert(trip.settings.title, t("passport2.cancelBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t(on ? "passport2.unmarkCancelled" : "passport2.markCancelled"),
        style: on ? "default" : "destructive",
        onPress: () => void setCancelled(trip.id, !on).catch(() => Alert.alert(t("passport2.saveFailed"))),
      },
    ]);
  }

  if (!ready) return (
    <View style={{ padding: space.gutter, gap: space.group }}>
      {loadError ? <><Text accessibilityRole="alert" style={[textRole.body, { color: mono.ink }]}>{t("passport2.loadFailed")}</Text><LineButton title={t("now.retry")} onPress={retryLoad} /></> : <ActivityIndicator accessibilityLabel={t("passport2.loading")} color={mono.accent} />}
    </View>
  );

  const pageNo = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 40, gap: space.section }}>
      {saveError && <View style={{ gap: space.group }}><Text accessibilityRole="alert" style={[textRole.body, { color: mono.ink }]}>{t("passport2.saveFailed")}</Text><LineButton title={t("now.retry")} onPress={retrySave} /></View>}
      {/* 사증 면. 옅은 종이 위에 도장을 두 칸씩 찍고, 쪽 번호를 단다. 빈 칸은 점선 자리로 남겨 다음 도장을 기다린다. */}
      <View style={{ gap: space.group }}>
        <SectionHead title={t("passport2.stamps")} right={<Text style={[textRole.meta, { color: mono.gray, fontVariant: ["tabular-nums"] }]}>{t("passport2.pages", { n: Math.max(1, Math.ceil(stamps.length / 4)) })}</Text>} />
        {/* 표지와 사증 면은 사진 재질을 쓴다. 가죽·종이는 CC0 텍스처, 보안 무늬는 MIT 생성기로 만든 그림이다(assets/passport/CREDITS.md).
            표지는 실제 여권처럼 금박 글자와 가운데 문장만 두고, 도장·나라 수는 표지 아래 한 줄로 뺀다. 정부 문장·전자여권 표시는 쓰지 않는다. */}
        <PassportBook openLabel={t("passport2.open")} hint={t("passport2.openHint")} closeLabel={t("passport2.close")}
          cover={
            <ImageBackground source={coverArt} resizeMode="cover" style={{ flex: 1 }} imageStyle={{ borderRadius: radius.card }}>
              <View style={{ flex: 1, margin: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: mono.foilRule, borderRadius: radius.card - 4, paddingVertical: 26, alignItems: "center", justifyContent: "space-between" }}>
                <Text allowFontScaling={false} style={{ fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 4, color: mono.foil }}>ESCALE</Text>
                <Seal size={64} color={mono.foil} />
                <View style={{ alignItems: "center", gap: 2 }}>
                  <Text accessibilityRole="header" style={[textRole.pageTitle, { color: mono.foil, letterSpacing: 2 }]}>{t("passport2.title")}</Text>
                  {!lang.startsWith("en") &&<Text allowFontScaling={false} style={{ fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 3, color: mono.foil }}>PASSPORT</Text>}
                </View>
              </View>
            </ImageBackground>
          }
        >
          <ImageBackground source={visaArt} resizeMode="cover" style={{ minHeight: 330, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 28 }} imageStyle={{ borderRadius: radius.card }}>
            <Text accessible={false} style={[textRole.attribution, { color: mono.visaMuted, letterSpacing: 2, marginBottom: 4 }]}>{t("passport2.visas").toUpperCase()}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
              {stamps.map((stamp, index) => {
                const trip = trips.find((x) => x.id === stamp.tripId);
                return (
                  <Pressable
                    key={stamp.id}
                    accessibilityRole={trip ? "button" : undefined}
                    disabled={!trip}
                    onPress={() => trip && toggleCancelled(trip)}
                    style={({ pressed }) => ({ width: "50%", alignItems: "center", gap: 4, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
                  >
                    <StampDrop index={index}><Stamp stamp={stamp} /></StampDrop>
                    <Text numberOfLines={1} style={[textRole.meta, { color: mono.visaMuted, textAlign: "center", paddingHorizontal: 8 }]}>{stamp.tripTitle}</Text>
                  </Pressable>
                );
              })}
              {Array.from({ length: stamps.length % 2 === 0 ? 2 : 1 }, (_, i) => (
                <View key={`slot${i}`} accessible={false} style={{ width: "50%", alignItems: "center", paddingVertical: 8 }}>
                  <View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderStyle: "dashed", borderColor: mono.visaMuted, opacity: 0.6, alignItems: "center", justifyContent: "center" }}>
                    <Text style={[textRole.meta, { color: mono.visaMuted }]}>{t("passport2.slot")}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text accessible={false} style={[textRole.attribution, { position: "absolute", right: 12, bottom: 8, color: mono.visaMuted, fontVariant: ["tabular-nums"] }]}>{pageNo(0)}</Text>
          </ImageBackground>
        </PassportBook>
        <Text style={[textRole.meta, { color: mono.gray, textAlign: "center", fontVariant: ["tabular-nums"] }]}>{t("passport2.summary", { stamps: passport.stamps.length, countries })}</Text>
        {!stamps.length && <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("passport2.empty")}</Text>}
      </View>

      {!!pending.length && (
        <View style={{ gap: space.group }}>
          <SectionHead title={t("passport2.pending")} />
          {pending.map((trip) => (
            <View key={trip.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mono.coral }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={[textRole.itemTitle, { color: mono.ink }]}>{trip.settings.title}</Text>
                <Text style={[textRole.meta, { color: mono.gray }]}>{formatDateRange(lang, trip.settings.startDate, trip.settings.endDate)}</Text>
              </View>
              <SolidButton title={t("passport2.confirm")} disabled={saving} onPress={() => confirmCompleted(trip)} style={{ minHeight: 40, paddingHorizontal: 14 }} />
            </View>
          ))}
        </View>
      )}

      {!!upcoming.length && (
        <View style={{ gap: space.group }}>
          <SectionHead title={t("passport2.upcoming")} />
          {upcoming.map((trip) => {
            const places = tripCountries(trip, lang);
            const off = cancelled.has(trip.id);
            const code = places[0]?.country.code;
            return (
              <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={trip.settings.title} onPress={() => toggleCancelled(trip)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderStyle: "dashed", borderColor: off ? mono.soft : mono.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text style={[textRole.label, { color: off ? mono.mutedText : mono.accentText }]}>{code ?? "?"}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={[textRole.itemTitle, { color: off ? mono.gray : mono.ink }]}>{trip.settings.title}</Text>
                  <Text numberOfLines={2} style={[textRole.meta, { color: mono.gray }]}>
                    {off
                      ? t("passport2.cancelled")
                      : places.length
                        ? `${places.map((p) => countryName(p.country.code, lang)).join(" · ")} · ${t("passport2.on", { date: formatDateRange(lang, trip.settings.endDate, trip.settings.endDate) })}`
                        : t("passport2.noCountry")}
                  </Text>
                </View>
                <Chevron />
              </Pressable>
            );
          })}
        </View>
      )}

      {cancelledTrips.some((trip) => returnDayReached(trip, now)) && (
        <View style={{ gap: space.group }}>
          <SectionHead title={t("passport2.cancelled")} />
          {cancelledTrips.filter((trip) => returnDayReached(trip, now)).map((trip) => (
            <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={trip.settings.title} onPress={() => toggleCancelled(trip)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, opacity: pressed ? 0.6 : 1 })}>
              <Text numberOfLines={1} style={[textRole.itemTitle, { flex: 1, color: mono.gray, textDecorationLine: "line-through" }]}>{trip.settings.title}</Text>
              <Chevron />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
