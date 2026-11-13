import { useState } from "react";
import { Linking,Pressable,Text,View,useWindowDimensions } from "react-native";
import { transitMapsUrl,type RouteEnd } from "../data/routes";
import { useI18n } from "../i18n/I18n";
import { timelineColumns } from "../theme/textScale";
import { mono,textRole } from "../theme/tokens";

/** 세로선 한 토막. 시간표 두 줄 사이를 잇는다. */
export function Stem() {
  return <View style={{ width: 1, alignSelf: "stretch", minHeight: 22, backgroundColor: mono.soft }} />;
}

/** 지도 핀과 같은 번호 동그라미. 지도에 없는 곳(위치 못 찾음)은 번호 대신 빈 동그라미로 둔다. */
function Pin({ n }: { n?: number }) {
  return (
    <View style={{ minWidth: 18, height: 18, paddingHorizontal: 3, borderRadius: 9, borderWidth: 1, borderColor: n ? mono.accent : mono.soft, backgroundColor: n ? mono.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
      {/* 22pt 동그라미 안 번호라 1.3배까지만 키운다(줄 높이 16 × 1.3 ≈ 21pt). 길찾기 내용은 접근성 이름과 옆 글자로 읽힌다. */}
      {!!n && <Text maxFontSizeMultiplier={1.3} style={[textRole.label, { fontSize: 11, lineHeight: 14, color: mono.onInk }]}>{n}</Text>}
    </View>
  );
}

// 계획 탭 두 일정 사이의 다리. 얇은 세로선에 출발·도착 핀 번호(그날 지도와 같은 번호)를 달고 Google 지도 길찾기로 넘긴다.
// 앱 안에서는 경로를 조회하지 않는다. 나라마다 교통 공급자가 달라 어느 나라에서든 같은 방식으로 동작하는 지도 앱에 맡긴다.
export function RouteLeg({ fromTitle, toTitle, origin, destination, fromPin, toPin }: { fromTitle: string; toTitle: string; origin: RouteEnd; destination: RouteEnd; fromPin?: number; toPin?: number }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const { fontScale, width } = useWindowDimensions();
  const { railInset } = timelineColumns(fontScale, width);
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingLeft: railInset }}>
      <Stem />
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("route.a11y", { from: fromTitle, to: toTitle })}
          onPress={() => {
            setFailed(false);
            Linking.openURL(transitMapsUrl(origin, destination)).catch(() => setFailed(true));
          }}
          style={({ pressed }) => ({ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 36, opacity: pressed ? 0.6 : 1 })}
        >
          <Pin n={fromPin} />
          <View style={{ width: 10, height: 1, backgroundColor: mono.soft }} />
          <Pin n={toPin} />
          <Text style={[textRole.meta, { flexShrink: 1, fontWeight: "600", color: mono.accentText }]}>{t("route.maps")}</Text>
        </Pressable>
        {failed && <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.warn, paddingBottom: 8 }]}>{t("route.mapsFailed")}</Text>}
      </View>
    </View>
  );
}
