import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Caption, Field, Label, TextAction, colors } from "./ui";
import { currencyOptions, timeZoneOptions, searchOptions, type SelectOption } from "../data/selectionOptions";
import { currencySymbol } from "../data/budgetPlan";
import type { CurrencyCode } from "../../../src/domain/money/types";
import { useI18n } from "../i18n/I18n";
import { Icon } from "../theme/mono";
import { mono, stroke, textRole } from "../theme/tokens";
// chip을 주면 이름 줄 대신 가운데 작은 네모 버튼으로 연다(지출 금액 위 통화처럼).
function SearchSelect({label,value,options,onChange,chip}:{label:string;value:string;options:SelectOption[];onChange:(value:string)=>void;chip?:string}) {
 const {t}=useI18n();
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const matches=searchOptions(options,query);
 const current=(options.find(o=>o.value===value)?.label ?? value) || t("select.choose");
 const toggle=()=>{setOpen(!open);setQuery("");};
 return <View style={{gap:8}}>
  {chip ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${current}`} accessibilityState={{expanded:open}} onPress={toggle} style={({pressed})=>({alignSelf:"center",minHeight:44,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:6,borderWidth:stroke.chip,borderColor:mono.ink,opacity:pressed ? .6 : 1})}>
   <Text style={[textRole.meta,{fontWeight:"600",color:mono.ink}]}>{chip}</Text>
   <Icon name="down" size={12} weight={2.4} />
  </Pressable> : <>
   <Label>{label}</Label>
   <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${current}`} accessibilityState={{expanded:open}} hitSlop={8} onPress={toggle} style={({pressed})=>({minHeight:44,alignSelf:"flex-start",paddingHorizontal:8,flexDirection:"row",alignItems:"center",gap:6,opacity:pressed ? .6 : 1})}><Text style={[textRole.control,{color:mono.ink}]}>{current}</Text><Icon name={open ? "up" : "down"} size={14} weight={2} /></Pressable>
  </>}
  {open && <View style={{gap:8,padding:12,borderWidth:1.5,borderColor:mono.ink}}>
   <Field label={t("select.search",{label})} value={query} onChangeText={setQuery} placeholder={t("select.placeholder")} autoCapitalize="none" maxLength={80} />
   {matches.slice(0,12).map(o=><Pressable key={o.value} accessibilityRole="radio" accessibilityState={{checked:value===o.value}} onPress={()=>{onChange(o.value);setOpen(false);setQuery("");}} style={{minHeight:44,flexDirection:"row",alignItems:"center",gap:6,paddingVertical:8}}>{value===o.value && <Icon name="check" size={16} weight={2} />}<Text style={[textRole.meta,{fontWeight:value===o.value ? "600" : "400",color:colors.ink}]}>{o.label}</Text></Pressable>)}
   {!matches.length && <Caption>{t("select.none")}</Caption>}
   {matches.length>12 && <Caption>{t("select.more",{n:matches.length})}</Caption>}
   <TextAction title={t("select.close")} onPress={()=>setOpen(false)} />
  </View>}
 </View>;
}
export function CurrencySelect({label,value,onChange,compact}:{label:string;value:string;onChange:(value:CurrencyCode)=>void;compact?:boolean}) {
 const symbol=currencySymbol(value as CurrencyCode);
 const {lang}=useI18n();
 const options=useMemo(()=>currencyOptions(lang),[lang]);
 return <SearchSelect label={label} value={value} options={options} onChange={v=>onChange(v as CurrencyCode)} chip={compact ? (symbol ? `${symbol} ${value}` : value) : undefined} />;
}
export function TimeZoneSelect({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
 const {lang}=useI18n();
 const options=useMemo(()=>timeZoneOptions(value,lang),[value,lang]);
 return <SearchSelect label={label} value={value} options={options} onChange={onChange} />;
}
