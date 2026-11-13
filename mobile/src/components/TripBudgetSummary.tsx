import { Pressable, Text, View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { formatMoney } from "../../../src/domain/money/currency";
import { tripBudgetSummary } from "../data/tripBudget";
import { useI18n } from "../i18n/I18n";
import { actionText, diary, mono, textRole } from "../theme/tokens";
import { Chevron } from "../theme/mono";
import { todaySpending } from "../data/notebookView";

export function TripBudgetSummary({trip,onPress,compact=false,overview=false,overviewDate}:{trip:TripWorkspace;onPress:()=>void;compact?:boolean;overview?:boolean;overviewDate?:string}) {
  const {t}=useI18n();
  const {total,spent,remaining}=tripBudgetSummary(trip);
  const money=(value:number)=>formatMoney(value,trip.settings.baseCurrency);
  if(overview) {
    const today = overviewDate ? todaySpending(trip, overviewDate).spent : undefined;
    const label = total===undefined ? t("overview.setBudget") : `${t(remaining!<0?"overview.over":"overview.remaining")} ${money(Math.abs(remaining!))}`;
    const spentToday = today === undefined ? "" : t("overview.todaySpent",{amount:money(today)});
    return <Pressable accessibilityRole="button" accessibilityLabel={[label, spentToday].filter(Boolean).join(", ")} onPress={onPress}
      style={({pressed})=>({minHeight:52,paddingVertical:12,borderBottomWidth:1,borderColor:mono.hair,flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10,opacity:pressed?.65:1})}>
      <Text lineBreakStrategyIOS="hangul-word" style={[textRole.itemTitle,{flexGrow:1,color:remaining!==undefined&&remaining<0?mono.warn:mono.ink}]}>{label}</Text>
      {!!spentToday && <Text style={[textRole.meta,{color:mono.gray}]}>{spentToday}</Text>}<Chevron />
    </Pressable>;
  }
  if(compact) return <Pressable accessibilityRole="button" accessibilityLabel={`${t("overview.budget")}, ${total===undefined?t("overview.setBudget"):money(total)}, ${t("overview.spent")} ${money(spent)}${remaining===undefined?"":`, ${t(remaining<0?"overview.over":"overview.remaining")} ${money(Math.abs(remaining))}`}`} onPress={onPress} style={({pressed})=>({minHeight:52,paddingVertical:10,gap:8,borderBottomWidth:1,borderColor:mono.hair,opacity:pressed?.6:1})}>
    {/* 강조는 중요한 쪽에만: 예산이 없으면 "정하기"가 할 일이고, 아직 0원인 쓴 돈은 회색 보조 정보다. */}
    <View style={{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10}}>
      {total===undefined ? <Text style={[actionText.inline,{flexGrow:1}]}>{t("overview.setBudget")}</Text>
        : <Text style={[textRole.meta,{flexGrow:1,color:mono.gray}]}>{t("overview.budget")}</Text>}
      {total!==undefined && <Text style={[textRole.pageTitle,{fontVariant:["tabular-nums"],color:mono.ink}]}>{money(total)}</Text>}
      {total===undefined && <Text style={[textRole.meta,{fontVariant:["tabular-nums"],color:mono.gray}]}>{t("overview.spent")} {money(spent)}</Text>}
      <Chevron />
    </View>
    {remaining!==undefined && <View style={{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8}}>
      <Text style={[textRole.meta,{color:mono.gray}]}>{t("overview.spent")} {money(spent)}</Text>
      <Text style={[textRole.meta,{color:remaining<0?mono.warn:mono.ink}]}>{t(remaining<0?"overview.over":"overview.remaining")} {money(Math.abs(remaining))}</Text>
    </View>}
  </Pressable>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t("overview.budget")}, ${total===undefined?t("overview.setBudget"):money(total)}, ${t("overview.spent")} ${money(spent)}${remaining===undefined?"":`, ${t(remaining<0?"overview.over":"overview.remaining")} ${money(Math.abs(remaining))}`}`} onPress={onPress} style={({pressed})=>({gap:8,paddingBottom:18,borderBottomWidth:1,borderColor:diary.edge,opacity:pressed?.6:1})}>
    {/* 칸 이름은 회색 이름표, 값은 금액. 예산이 없으면 값 자리에 할 일을 행동 글자로 둔다. 위 선은 장 제목이 긋는다. */}
    <View style={{flexDirection:"row",alignItems:"center",gap:10}}><Text style={[textRole.meta,{flex:1,color:mono.gray}]}>{t("overview.budget")}</Text><Chevron /></View>
    <Text style={total===undefined?actionText.inline:[textRole.feature,{color:mono.ink}]}>{total===undefined ? t("overview.setBudget") : money(total)}</Text>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:18}}>
      <Text style={[textRole.meta,{color:mono.gray}]}>{t("overview.spent")} {money(spent)}</Text>
      {remaining!==undefined && <Text style={[textRole.meta,{color:remaining<0?mono.warn:mono.ink}]}>{t(remaining<0?"overview.over":"overview.remaining")} {money(Math.abs(remaining))}</Text>}
    </View>
  </Pressable>;
}
