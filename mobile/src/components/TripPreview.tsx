import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { todayStore } from "../data/sqlite";
import { heroExists, heroFile } from "../data/heroPhoto";
import { diary, mono, space, textRole } from "../theme/tokens";
import { Icon } from "../theme/mono";
import { useI18n } from "../i18n/I18n";
import { formatDateRange } from "../i18n/strings";

// 대표 여행은 사진 카드로, 나머지(compact)는 구분선으로 나뉜 한 줄로 보여 준다.
// 목록 항목마다 카드를 씌우면 한 화면에 3개 남짓만 들어가고 대표 여행과 위계가 같아진다.
// 기존 대표 사진은 한 줄에서도 작은 썸네일로 그대로 사용한다.
export function TripPreview({ trip, compact = false }: { trip: TripWorkspace; compact?: boolean }) {
  const [uri, setUri] = useState<string>();
  const { lang } = useI18n();
  useEffect(() => {
    let alive = true;
    setUri(undefined);
    void todayStore.get(`hero:${trip.id}`).then(name => {
      if (alive && name && heroExists(name)) setUri(heroFile(name).uri);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [trip.id]);
  const date = formatDateRange(lang, trip.settings.startDate, trip.settings.endDate);
  if (compact) {
    const place = trip.settings.destination;
    return <View style={{ flexDirection: "row", alignItems: "center", gap: space.group, minHeight: 72, paddingVertical: space.group, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: mono.rule }}>
      <View style={{ width: space.touch, height: space.touch, borderRadius: diary.radius, overflow: "hidden", backgroundColor: diary.surface, alignItems: "center", justifyContent: "center" }}>
        {uri ? <Image accessible={false} source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <Icon name="pin" size={18} color={mono.accent}/>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[textRole.itemTitle, { color: mono.ink }]}>{trip.settings.title}</Text>
        <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray }]}>{place ? `${place} · ${date}` : date}</Text>
      </View>
      <Icon name="chevron" size={18} color={mono.gray}/>
    </View>;
  }
  return <View style={{ borderRadius: diary.radius, overflow: "hidden", backgroundColor: diary.surface, borderWidth: 1, borderColor: mono.hair }}>
    {uri && <Image accessible={false} source={{ uri }} style={{ width: "100%", height: compact ? 112 : 148 }} resizeMode="cover" />}
    <View style={{ padding: space.gutter, gap: 12 }}>
      {!uri && <View style={{flexDirection:"row",alignItems:"center",gap:6}}>
        <Icon name="pin" size={16} color={mono.accent}/>
        <Text style={[textRole.meta,{color:mono.gray}]}>{trip.settings.destination || trip.settings.startDate.slice(0,4)}</Text>
      </View>}
      <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
        <View style={{flex:1,gap:5}}>
          <Text style={[textRole.pageTitle, { color: mono.ink }]}>{trip.settings.title}</Text>
          <Text style={[textRole.meta, { color: mono.gray }]}>{date}</Text>
        </View>
        <Icon name="chevron" size={18} color={mono.gray}/>
      </View>
    </View>
  </View>;
}
