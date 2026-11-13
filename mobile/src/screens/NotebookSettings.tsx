import { CurrencySelect, TimeZoneSelect } from "../components/SearchSelect";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { tripFormFromSettings, updateTripSettings, validateTripForm, type TripFormIssue } from "../../../src/domain/workspace/tripForm";
import { Button, Caption, DateField, Field, Sheet, TextAction, Title, s } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { Key } from "../i18n/strings";
import { space } from "../theme/tokens";

/** 수첩 만들기·설정이 함께 쓰는 검사 문구 */
export const tripIssueKey: Record<TripFormIssue, Key> = {
  title: "trip.issue.title", destination: "trip.issue.destination", dates: "trip.issue.dates", "too-long": "trip.issue.tooLong",
  "time-zone": "trip.issue.zone", currency: "trip.issue.currency", "currency-in-use": "trip.issue.currencyInUse",
  "schedule-dates": "trip.issue.scheduleDates", members: "trip.issue.members", "member-name": "trip.issue.memberName",
  "duplicate-member": "trip.issue.duplicateMember", "owner-removed": "trip.issue.ownerRemoved",
  "member-in-use": "trip.issue.memberInUse", reservations: "trip.issue.reservations",
};
// onDelete는 확인 창을 띄우는 쪽에서 넘긴다. Android 알림창은 버튼을 3개까지만 보여 수첩 메뉴의 삭제가 숨을 수 있어 여기에도 둔다.
export function NotebookSettings({trip,saving,onSave,onDirtyChange,onDelete}:{trip:TripWorkspace;saving:boolean;onSave:(trip:TripWorkspace)=>Promise<void>;onDirtyChange:(dirty:boolean)=>void;onDelete?:()=>void}) {
  const { t } = useI18n();
  const [input,setInput] = useState(()=>tripFormFromSettings(trip.settings));
  const [errors,setErrors] = useState<string[]>([]);
  const dirty = JSON.stringify(input) !== JSON.stringify(tripFormFromSettings(trip.settings));
  useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
  const outside = (trip.reservations ?? []).some(r=>r.startDate < input.startDate || (r.endDate ?? r.startDate) > input.endDate);
  async function save() {
    const issues = validateTripForm(input,trip);
    if(issues.length) {setErrors(issues.map(i=>t(tripIssueKey[i])));return;}
    try { await onSave(updateTripSettings(trip,input,new Date())); }
    catch { setErrors([t("trip.saveError")]); }
  }
  return <View style={{flex:1}}>
    <Sheet>
      <Title>{t("trip.settings")}</Title>
      <Field label={t("trip.name")} value={input.title} maxLength={120} onChangeText={title=>setInput(v=>({...v,title}))} />
      <Field label={t("trip.destination")} value={input.destination} maxLength={120} onChangeText={destination=>setInput(v=>({...v,destination}))} />
      <DateField label={t("trip.start")} value={input.startDate} onChange={startDate=>setInput(v=>({...v,startDate}))} />
      <DateField label={t("trip.end")} value={input.endDate} onChange={endDate=>setInput(v=>({...v,endDate}))} />
      <Caption>{t("trip.datesNote")}</Caption>
      {outside && <Caption>{t("trip.outside")}</Caption>}
      <TimeZoneSelect label={t("trip.zone")} value={input.timeZone!} onChange={timeZone=>setInput(v=>({...v,timeZone}))} />
      <Caption>{t("trip.zoneNote")}</Caption>
      {input.members.map((member,index)=><View key={member.id ?? `new-${index}`}>
        <Field label={index===0 ? t("trip.owner") : t("trip.member",{n:index})} value={member.name} maxLength={40} onChangeText={name=>setInput(v=>({...v,members:v.members.map((m,i)=>i===index ? {...m,name} : m)}))} />
        {index>0 && <TextAction title={t("trip.removeMember",{name:member.name || t("trip.memberFallback")})} onPress={()=>setInput(v=>({...v,members:v.members.filter((_,i)=>i!==index)}))} />}
      </View>)}
      <TextAction title={t("trip.addMember")} icon="plus" disabled={input.members.length>=20} onPress={()=>setInput(v=>({...v,members:[...v.members,{name:""}]}))} />
      <Caption>{t("trip.designNote")}</Caption>
      <CurrencySelect label={t("trip.local")} value={input.localCurrency!} onChange={localCurrency=>setInput(v=>({...v,localCurrency}))} />
      <CurrencySelect label={t("trip.base")} value={input.baseCurrency} onChange={baseCurrency=>setInput(v=>({...v,baseCurrency}))} />
    </Sheet>
    <View style={{paddingHorizontal:space.gutter,paddingVertical:12,gap:8}}>
      {errors.map(e=><Text key={e} accessibilityRole="alert" style={s.error}>{e}</Text>)}
      <Button title={t(saving ? "money.saving" : "trip.save")} disabled={saving || !dirty} onPress={()=>void save()} />
      {onDelete && <TextAction danger title={t("app.deleteNotebook")} disabled={saving} onPress={onDelete} />}
    </View>
  </View>;
}
