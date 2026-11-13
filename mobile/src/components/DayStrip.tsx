import { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { dayStripWidth } from "../data/dayStripWidth";
import type { TripDay } from "../data/dayPlan";
import { useI18n } from "../i18n/I18n";
import { weekdayShort } from "../i18n/strings";
import { mono, radius, scrapbook, space, textRole } from "../theme/tokens";

const GAP = 8;

/** 여행 날짜 밑줄 탭. 계획과 추천이 같이 쓴다. counts가 있으면 그날 일정 수만큼 점을 찍는다(최대 4). */
export function DayStrip({ days, selected, today, counts, label, onSelect }: { days: TripDay[]; selected: string; today: string; counts?: Record<string, number>; label: (day: TripDay) => string; onSelect: (date: string) => void }) {
  const { t, lang } = useI18n();
  const { fontScale } = useWindowDimensions();
  const [available, setAvailable] = useState(0);
  // 칸 너비는 날짜 글자("11.10 화")가 들어갈 만큼, 그리고 누름 영역 이상.
  const width = dayStripWidth({ available, count: days.length, gap: GAP, min: Math.max(space.touch, Math.ceil(64 * fontScale)) });
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setAvailable(e.nativeEvent.layout.width - space.gutter * 2)}
      contentContainerStyle={{ gap: GAP, paddingHorizontal: space.gutter }}
      style={{ marginHorizontal: -space.gutter, flexGrow: 0 }}
    >
      {days.map((d) => {
        const on = d.date === selected;
        const past = d.date < today;
        return (
          <Pressable
            key={d.date}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label(d)}
            onPress={() => onSelect(d.date)}
            // 일기 탭의 사진/발자국과 같은 밑줄 탭. 고른 날에만 잉크 밑줄을 긋고 채움·기울임·점선은 두지 않는다.
            style={({ pressed }) => ({ width, minHeight: space.touch, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: radius.control, backgroundColor: on ? mono.accent : "transparent", borderBottomWidth: 0, opacity: pressed ? 0.6 : 1 })}
          >
            {/* 일차가 먼저 읽히고 날짜·요일은 그 아래 작게. 오늘은 산호색 이름표로 짚는다. */}
            <Text style={[textRole.control, { fontVariant: ["tabular-nums"], fontWeight: on ? "600" : "400", color: on ? mono.onInk : mono.gray }]}>{t("plan.dayN", { n: d.index })}</Text>
            <Text style={[textRole.label, { fontWeight: "400", fontVariant: ["tabular-nums"], color: on ? mono.onInk : d.isToday ? scrapbook.pink : past ? mono.gray : mono.ink }]}>{d.isToday ? t("plan.today") : `${Number(d.date.slice(5, 7))}.${Number(d.date.slice(8, 10))} ${weekdayShort(lang, d.date)}`}</Text>
            {counts && (
              <View style={{ flexDirection: "row", gap: 2, height: 4 }}>
                {Array.from({ length: Math.min(4, counts[d.date] ?? 0) }, (_, i) => (
                  <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: on ? mono.onInk : past ? mono.soft : mono.ink }} />
                ))}
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
