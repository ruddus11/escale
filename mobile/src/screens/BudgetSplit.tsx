import { useState } from "react";
import { ScrollView,Text,TextInput,View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { parseMoney } from "../../../src/domain/money/currency";
import { CATEGORIES,DEFAULT_SHARES,EVEN_SHARES,envelopeLimits,moveShare,plainAmount,prepaid,sharesOf,type Shares } from "../data/budgetPlan";
import { useI18n } from "../i18n/I18n";
import { Heading,IconButton,LineButton,SolidButton,Stacked,Swatch } from "../theme/mono";
import { mono,space,textRole } from "../theme/tokens";
import { AlreadyPaid,categoryKey } from "./BudgetPage";

const STEP = 5;

// 하루 예산과 분류별 봉투 비율을 정한다. 금액을 고치면 봉투 금액은 비율대로 다시 계산된다.
export function BudgetSplit({
  trip,
  saving,
  onSave,
}: {
  trip: TripWorkspace;
  saving: boolean;
  onSave: (value: { totalBudgetMinor?: number; dailyBudgetMinor?: number; categoryShares: Shares }) => Promise<void>;
}) {
  const { t, title } = useI18n();
  const base = trip.settings.baseCurrency;
  const initial = trip.budget.dailyBudgetMinor;
  const [totalText,setTotalText]=useState(trip.budget.totalBudgetMinor===undefined?"":plainAmount(trip.budget.totalBudgetMinor,base));
  const total=totalText.trim()?parseMoney(totalText.replace(/,/g,""),base):undefined;
  const [text, setText] = useState(initial === undefined ? "" : plainAmount(initial, base));
  const [shares, setShares] = useState<Shares>(sharesOf(trip));
  const [error, setError] = useState("");
  const daily = text.trim() ? parseMoney(text.replace(/,/g, ""), base) : undefined;
  const limits = daily !== undefined ? envelopeLimits(daily, shares) : undefined;
  const days = Math.round((Date.parse(`${trip.settings.endDate}T00:00:00Z`) - Date.parse(`${trip.settings.startDate}T00:00:00Z`)) / 86400000) + 1;

  async function save() {
    if ((totalText.trim() && total===undefined) || (text.trim() && daily === undefined)) {
      setError(t("money.checkAmount"));
      return;
    }
    try {
      await onSave({ totalBudgetMinor:total, dailyBudgetMinor: daily, categoryShares: shares });
    } catch {
      setError(t("money.saveError"));
    }
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 14, paddingBottom: 48, gap: 24 }}>
      <Heading title={title("budget")} />

      <View style={{gap:8}}><Text style={[textRole.itemTitle,{color:mono.ink}]}>{t("overview.budget")}</Text><TextInput accessibilityLabel={t("overview.budget")} value={totalText} onChangeText={value=>{setTotalText(value);setError("");}} keyboardType="decimal-pad" maxLength={14} placeholder={t("overview.setBudget")} placeholderTextColor={mono.gray} editable={!saving} style={{minHeight:54,borderBottomWidth:1,borderColor:mono.hair,...textRole.feature,color:mono.ink}}/><Text style={[textRole.meta,{color:mono.gray}]}>{base}</Text></View>
      <Text style={[textRole.itemTitle,{color:mono.ink}]}>{t("money.perDay")}</Text>
      <View style={{ gap: 6, paddingBottom: 10, borderBottomWidth: 1.5, borderColor: mono.ink }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <TextInput
            accessibilityLabel={t("money.perDay")}
            value={text}
            onChangeText={(value) => {
              setText(value);
              setError("");
            }}
            placeholder="0"
            placeholderTextColor={mono.mutedText}
            keyboardType="decimal-pad"
            maxLength={14}
            style={{ flex: 1, ...textRole.feature, color: mono.ink, paddingVertical: 2 }}
          />
          <Text style={[textRole.itemTitle, { color: mono.ink }]}>{base}</Text>
        </View>
        {daily !== undefined && <Text style={[textRole.meta, { color: mono.gray }]}>{t("money.days", { n: days, total: `${plainAmount(daily * days, base)} ${base}` })}</Text>}
      </View>

      <Stacked parts={CATEGORIES.map((c) => ({ category: c.key, ratio: shares[c.key] / 100 }))} height={10} />

      <View>
        {CATEGORIES.map((c, i) => {
          const name = t(categoryKey(c.key));
          return (
            <View key={c.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: i < CATEGORIES.length - 1 ? 1 : 0, borderColor: mono.hair }}>
              <Swatch category={c.key} />
              <Text style={[textRole.itemTitle, { flex: 1, color: mono.ink }]}>{name}</Text>
              <Step label={t("money.less", { name })} icon="minus" onPress={() => setShares((v) => moveShare(v, c.key, -STEP))} />
              <View style={{ width: 84, alignItems: "center" }}>
                <Text style={[textRole.itemTitle, { fontVariant: ["tabular-nums"], color: mono.ink }]}>{limits ? plainAmount(limits[c.key], base) : `${shares[c.key]}%`}</Text>
                {limits && <Text style={[textRole.label, { color: mono.gray }]}>{shares[c.key]}%</Text>}
              </View>
              <Step label={t("money.more", { name })} icon="plus" solid onPress={() => setShares((v) => moveShare(v, c.key, STEP))} />
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <SolidButton title={t("money.default")} style={{ flex: 1 }} onPress={() => setShares({ ...DEFAULT_SHARES })} />
        <LineButton title={t("money.even")} style={{ flex: 1 }} onPress={() => setShares({ ...EVEN_SHARES })} />
      </View>

      {!!prepaid(trip).length && <AlreadyPaid trip={trip} />}

      {!!error && (
        <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.warn }]}>
          {error}
        </Text>
      )}
      <SolidButton title={saving ? t("money.saving") : t("money.done")} disabled={saving} onPress={() => void save()} />
    </ScrollView>
  );
}

// 비율 한 칸 올리기·내리기. 원형 아이콘 버튼(44pt) 규칙을 그대로 쓴다.
function Step({ label, icon, solid, onPress }: { label: string; icon: "minus" | "plus"; solid?: boolean; onPress: () => void }) {
  return <IconButton icon={icon} label={label} solid={solid} onPress={onPress} />;
}
