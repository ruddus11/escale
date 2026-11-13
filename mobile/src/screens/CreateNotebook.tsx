import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { randomUUID } from "expo-crypto";
import { createTrip, validateTripForm, type TripFormInput } from "../../../src/domain/workspace/tripForm";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { deviceTimeZone, zonedDate } from "../../../src/domain/time/zoned";
import { useI18n } from "../i18n/I18n";
import { CurrencySelect, TimeZoneSelect } from "../components/SearchSelect";
import { Caption, colors, DateField, Field, s } from "../components/ui";
import { diary, mono, radius, space, textRole } from "../theme/tokens";
import { IconButton, SolidButton, TopBar } from "../theme/mono";
import { localCurrencyAfterZoneChange, suggestCurrencyForZone } from "../data/zoneCurrency";

// 새 여행. 이름 → 여행지 → 날짜 → 시간대·통화 → 동행자 순서로 한 화면에 적는다.
export function CreateNotebook({onCreate,onCancel,saving}:{
  onCreate:(trip:TripWorkspace)=>Promise<void>;
  onCancel:()=>void;
  saving:boolean;
}) {
  const {t}=useI18n();
  const {fontScale}=useWindowDimensions();
  const [input,setInput]=useState<TripFormInput>(()=>{
    const zone=deviceTimeZone(),today=zonedDate(new Date(),zone);
    return {title:"",destination:"",startDate:today,endDate:today,timeZone:zone,baseCurrency:"KRW",localCurrency:"KRW",members:[{name:t("trip.me")}],coverColor:"ink"};
  });
  const [companions,setCompanions]=useState("");
  // 현지 통화를 한 번이라도 직접 고르면 이후 시간대 변경이 덮어쓰지 않는다.
  const currencyPicked=useRef(false);
  const [currencySuggested,setCurrencySuggested]=useState(false);
  const [error,setError]=useState("");
  const nameRef=useRef<TextInput>(null);
  const busy=useRef(false);
  async function finish() {
    if (busy.current || saving) return;
    if (!input.title.trim()) {setError(t("create.needName"));nameRef.current?.focus();return;}
    const value={...input,title:input.title.trim(),coverColor:"ink" as const,members:[{name:t("trip.me")},...companions.split(/[,，、]/).map(name=>({name:name.trim()})).filter(m=>m.name)]};
    if(validateTripForm(value).length) {setError(t("create.checkTrip"));return;}
    busy.current=true;
    setError("");
    try {await onCreate(createTrip(value,{id:randomUUID(),now:new Date()}));}
    catch {setError(t("editor.saveError"));}
    finally {busy.current=false;}
  }
  return <View style={{flex:1}}>
    <TopBar
      left={<IconButton finish="silver" icon="close" label={t("common.cancel")} onPress={onCancel} disabled={saving} />}
      center={fontScale>1.5 ? undefined : <Text accessibilityRole="header" style={[textRole.itemTitle,{color:mono.ink}]}>{t("library.new")}</Text>}
      right={saving ? <ActivityIndicator accessibilityLabel={t("create.saving")} color={mono.ink} /> : <SolidButton title={t("create.make")} disabled={saving} onPress={()=>void finish()} style={{minHeight:44,paddingHorizontal:18}} />}
    />
    {!!error && <Text accessibilityRole="alert" style={[s.error,{paddingHorizontal:space.gutter,paddingVertical:8}]}>{error}</Text>}
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{paddingHorizontal:space.gutter,paddingTop:12,paddingBottom:32,gap:16}}>
      {fontScale>1.5 && <Text accessibilityRole="header" style={[textRole.itemTitle,{color:mono.ink}]}>{t("library.new")}</Text>}
      <View style={{minHeight:60,flexDirection:"row",alignItems:"center",gap:12,borderRadius:radius.control,backgroundColor:diary.surface,paddingHorizontal:14}}>
        <TextInput ref={nameRef} autoFocus editable={!saving} accessibilityLabel={t("trip.name")} placeholder={t("trip.name")} placeholderTextColor={colors.muted} value={input.title} onChangeText={title=>{setInput(v=>({...v,title}));if(title.trim() && error===t("create.needName"))setError("");}} maxLength={120} returnKeyType="done" style={[textRole.pageTitle,{flex:1,minWidth:0,color:colors.ink,paddingVertical:14}]} />
      </View>
      <View style={{gap:16}}>
          <Caption>{t("create.datesNote")}</Caption>
          <Field label={t("create.destination")} value={input.destination} maxLength={120} onChangeText={destination=>setInput(v=>({...v,destination}))} />
          <DateField line label={t("trip.start")} value={input.startDate} onChange={startDate=>setInput(v=>({...v,startDate,endDate:v.endDate<startDate ? startDate : v.endDate}))} />
          <DateField line label={t("trip.end")} value={input.endDate} onChange={endDate=>setInput(v=>({...v,endDate}))} />
          <TimeZoneSelect label={t("trip.zone")} value={input.timeZone!} onChange={timeZone=>{
            const suggestion=suggestCurrencyForZone(timeZone);
            setCurrencySuggested(!currencyPicked.current && suggestion!==undefined && suggestion!==input.localCurrency);
            setInput(v=>({...v,timeZone,localCurrency:localCurrencyAfterZoneChange(timeZone,v.localCurrency!,currencyPicked.current)}));
          }} />
          <CurrencySelect label={t("trip.local")} value={input.localCurrency!} onChange={localCurrency=>{currencyPicked.current=true;setCurrencySuggested(false);setInput(v=>({...v,localCurrency}));}} />
          {currencySuggested && <Caption>{t("create.currencyNote")}</Caption>}
          <CurrencySelect label={t("trip.base")} value={input.baseCurrency} onChange={baseCurrency=>setInput(v=>({...v,baseCurrency}))} />
          <Field label={t("create.companions")} value={companions} onChangeText={setCompanions} placeholder={t("create.companionsHint")} maxLength={500} />
      </View>
    </ScrollView>
  </View>;
}
