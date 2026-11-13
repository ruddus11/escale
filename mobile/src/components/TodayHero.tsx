import { useEffect,useState } from "react";
import { Alert,Image,Pressable,Text,View } from "react-native";
import { heroSource } from "../data/firstPage";
import { heroExists,heroFile,pickHeroPhoto,removeHeroPhoto } from "../data/heroPhoto";
import { todayStore } from "../data/sqlite";
import { useI18n } from "../i18n/I18n";
import { Icon,Seal } from "../theme/mono";
import { diary,mono,radius,textRole } from "../theme/tokens";


import { formatDateRange } from "../i18n/strings";

// 직접 고른 사진만 표지로 쓴다. 사진이 없어도 여행 정보와 변경 동작은 유지한다.
export function TodayHero({ tripId, title, startDate, endDate, status, compact }: { tripId: string; title: string; startDate: string; endDate: string; status: string; compact?: boolean }) {
  const { t, lang } = useI18n();
  const key = `hero:${tripId}`;
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setName(null);
    todayStore.get(key).then(
      (saved) => {
        if (!alive) return;
        const source = heroSource(saved, heroExists);
        setName(source.kind === "photo" ? source.name : null);
        // 파일이 없어졌으면 설정도 지운다.
        if (saved && source.kind === "cover") void todayStore.remove(key).catch(() => undefined);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [key]);

  async function pick() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await pickHeroPhoto(tripId);
      if (!next) return;
      await todayStore.set(key, next);
      removeHeroPhoto(name);
      setName(next);
    } catch {
      Alert.alert(t("hero.failed"));
    } finally {
      setBusy(false);
    }
  }
  async function restoreCover() {
    if (busy) return;
    setBusy(true);
    try {
      await todayStore.remove(key);
      removeHeroPhoto(name);
      setName(null);
    } catch {
      Alert.alert(t("hero.failed"));
    } finally {
      setBusy(false);
    }
  }
  function change() {
    Alert.alert(t("hero.change"), undefined, [
      { text: t("hero.pick"), onPress: () => void pick() },
      ...(name ? [{ text: t("hero.cover"), onPress: () => void restoreCover() }] : []),
      { text: t("common.cancel"), style: "cancel" as const },
    ]);
  }
  // 2026-11-13 시안: 사진을 꽉 채우고 아래 띠에 상태 칩, 여행 이름, 날짜를 올린다.
  // 사진을 고르지 않은 여행은 바다색 면에 돛 표시만 크게 둔다. 흔한 풍경 사진으로 채우지 않는다.
  return (
    <View style={{borderRadius:diary.radius,overflow:"hidden",backgroundColor:mono.sea,height:compact ? 180 : 220,justifyContent:"flex-end"}}>
      {name ? <Image source={{uri:heroFile(name).uri}} resizeMode="cover" accessible={false}
        style={{position:"absolute",top:0,left:0,right:0,bottom:0,width:"100%",height:"100%"}} />
        : <View accessible={false} style={{position:"absolute",right:-24,top:20}}><Seal size={compact ? 150 : 190} color={mono.heroMark}/></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={name ? t("hero.change") : t("hero.add")}
        accessibilityState={{disabled:busy}} disabled={busy} onPress={name ? change : () => void pick()}
        style={({pressed}) => ({position:"absolute",top:12,right:12,width:44,height:44,borderRadius:radius.control,alignItems:"center",justifyContent:"center",backgroundColor:mono.frost,opacity:pressed || busy ? 0.6 : 1})}>
        <Icon name="camera" size={18} color={mono.sea}/>
      </Pressable>
      <View style={{backgroundColor:mono.heroVeil,paddingHorizontal:16,paddingTop:12,paddingBottom:14,gap:4}}>
        <Text style={[textRole.label,{alignSelf:"flex-start",color:mono.sea,backgroundColor:mono.coralChip,paddingHorizontal:8,paddingVertical:2,borderRadius:radius.pill,overflow:"hidden"}]}>{status}</Text>
        <Text accessibilityRole="header" numberOfLines={2} style={[textRole.pageTitle,{color:mono.white}]}>{title}</Text>
        <Text style={[textRole.meta,{fontVariant:["tabular-nums"],color:mono.onSea}]}>{formatDateRange(lang,startDate,endDate)}</Text>
      </View>
    </View>
  );
}
