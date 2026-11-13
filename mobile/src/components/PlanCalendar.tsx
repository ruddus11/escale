import { useState } from "react";
import { Segmented, TextLink } from "../theme/mono";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../i18n/I18n";
import { mono, radius, textRole } from "../theme/tokens";
import { monthGrid, weekGrid, shiftWeek } from "../data/planCalendar";

const WEEK = { ko: ["일", "월", "화", "수", "목", "금", "토"], en: ["S", "M", "T", "W", "T", "F", "S"], ja: ["日", "月", "火", "水", "木", "金", "土"] } as const;

/**
 * 여행 기간의 달력. 여행 날만 누를 수 있고, 일정 수만큼 점을 찍는다(최대 3).
 * 고른 날은 딥 틸 원, 오늘은 산호 점. 시간표·지도와 같은 고른 날짜를 쓴다.
 */
export function PlanCalendar({ start, end, selected, today, counts, onSelect }: { start: string; end: string; selected: string; today: string; counts: Record<string, number>; onSelect: (date: string) => void }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<"month" | "week">("month");
  const dates = weekGrid(selected);
  const grids = mode === "month" ? monthGrid(start, end) : [{ key: selected, year: Number(selected.slice(0, 4)), month: Number(selected.slice(5, 7)), weeks: [dates] }];
  const week = WEEK[lang === "ko" ? "ko" : lang === "ja" ? "ja" : "en"];
  return (
    <View style={{ gap: 18 }}>
      <Segmented items={[{ key: "month", title: t("planv.monthView") }, { key: "week", title: t("planv.weekView") }]} value={mode} onChange={setMode} label={t("planv.calendarRange")} />
      {mode === "week" && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <TextLink title={t("planv.previousWeek")} disabled={dates[0] <= start} onPress={() => onSelect(shiftWeek(selected, -1, start, end))} />
          <Text style={[textRole.meta, { color: mono.gray }]}>{`${dates[0].slice(5)} – ${dates[6].slice(5)}`}</Text>
          <TextLink title={t("planv.nextWeek")} disabled={dates[6] >= end} onPress={() => onSelect(shiftWeek(selected, 1, start, end))} />
        </View>
      )}
      {grids.map((month) => (
        <View key={month.key} style={{ gap: 8 }}>
          <Text style={[textRole.sectionTitle, { color: mono.ink }]}>{t("planv.month", { y: month.year, m: month.month })}</Text>
          <View style={{ flexDirection: "row" }}>
            {week.map((d, i) => (
              <Text key={i} style={[textRole.label, { flex: 1, textAlign: "center", fontWeight: "400", color: mono.gray }]}>{d}</Text>
            ))}
          </View>
          {month.weeks.map((days, w) => (
            <View key={w} style={{ flexDirection: "row" }}>
              {days.map((date, i) => {
                if (!date) return <View key={i} style={{ flex: 1, height: 52 }} />;
                const inTrip = date >= start && date <= end;
                const on = date === selected;
                const n = counts[date] ?? 0;
                return (
                  <Pressable
                    key={date}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: !inTrip }}
                    accessibilityLabel={`${date}${n ? `, ${t("planv.dayCount", { n })}` : ""}`}
                    disabled={!inTrip}
                    onPress={() => onSelect(date)}
                    style={({ pressed }) => ({ flex: 1, height: 52, alignItems: "center", justifyContent: "center", gap: 3, opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: on ? mono.accent : inTrip ? mono.accentSoft : "transparent" }}>
                      <Text style={[textRole.itemTitle, { fontVariant: ["tabular-nums"], fontWeight: on ? "600" : "400", color: on ? mono.onInk : inTrip ? mono.ink : mono.soft }]}>{Number(date.slice(8, 10))}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 2, height: 4 }}>
                      {date === today && !n ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: mono.coral }} /> : null}
                      {Array.from({ length: Math.min(3, n) }, (_, k) => (
                        <View key={k} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: date === today && k === 0 ? mono.coral : mono.accent }} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
