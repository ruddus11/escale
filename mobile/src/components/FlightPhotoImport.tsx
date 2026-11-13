import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { deleteCacheCopies } from "../data/photoFiles";
import { randomUUID } from "expo-crypto";
import type { Reservation } from "../../../src/domain/reservations/types";
import { isDateOnly } from "../../../src/repositories/schemaGuards";
import { canReadReceipts, readReceiptBlocks } from "../../modules/receipt-text";
import { confirmedFlight, duplicateFlight, emptyFlightDraft, parseFlightLegs, type FlightPhotoDraft } from "../data/flightPhoto";
import { useI18n } from "../i18n/I18n";
import { Check, LineButton, SolidButton } from "../theme/mono";
import { mono, textRole } from "../theme/tokens";
import { Field } from "./ui";
import { TimeZoneSelect } from "./SearchSelect";
import { TransportTicket } from "./TravelBookings";

type Leg = { id: string; draft: FlightPhotoDraft; include: boolean; editing: boolean };

/** 원본과 OCR 원문은 저장하지 않는다. 한 장에서 찾은 구간마다 사용자가 확인한 것만 기존 예약 저장 경로로 보낸다. */
export function FlightPhotoImport({ initial, existing, saving, onSave, onSaveMany }: {
  initial: Reservation; existing: Reservation[]; saving: boolean;
  onSave: (r: Reservation) => Promise<void>;
  /** 왕복처럼 여러 구간을 한 번에 넣는다. 없으면 구간을 하나씩만 넣을 수 있다. */
  onSaveMany?: (rs: Reservation[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [legs, setLegs] = useState<Leg[]>();
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true), pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const busy = reading || saving;
  const chosen = legs?.filter(leg => leg.include) ?? [];
  const valid = chosen.length > 0 && (chosen.length === 1 || !!onSaveMany)
    && chosen.every(leg => confirmedFlight(leg.draft, leg.id, initial.updatedAt));
  const update = (index: number, change: Partial<Leg>) => {
    if (saving || pending.current) return;
    setMessage("");
    setLegs(all => all?.map((leg, i) => i === index ? { ...leg, ...change } : leg));
  };
  const field = (index: number, key: keyof FlightPhotoDraft, value: string) =>
    legs && update(index, { draft: { ...legs[index].draft, [key]: value } });

  async function pick() {
    if (pending.current || saving) return;
    pending.current = true;
    setMessage(""); setReading(true);
    let uri: string | undefined;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, exif: false, allowsMultipleSelection: false });
      if (result.canceled) return;
      if (mounted.current) setLegs(undefined);
      uri = result.assets[0]?.uri;
      if (!uri) throw new Error("No image");
      const drafts = parseFlightLegs(await readReceiptBlocks(uri));
      // 첫 구간은 열어 둔 새 예약의 id를 이어 쓰고, 나머지 구간은 새 id를 받는다.
      const next = (drafts.length ? drafts : [emptyFlightDraft()]).map((draft, i): Leg => {
        const id = i ? randomUUID() : initial.id;
        const duplicate = duplicateFlight(draft, existing);
        return { id, draft, include: !duplicate, editing: !duplicate && !confirmedFlight(draft, id, initial.updatedAt) };
      });
      if (mounted.current) {
        setLegs(next);
        if (next.some(leg => leg.editing)) setMessage(t("stayPhoto.missing"));
      }
    } catch { if (mounted.current) setMessage(t("stayPhoto.failed")); }
    finally {
      deleteCacheCopies([uri]);
      pending.current = false;
      if (mounted.current) setReading(false);
    }
  }

  async function save() {
    if (pending.current || saving || !chosen.length) return;
    const now = new Date().toISOString();
    const ready = chosen.map(leg => confirmedFlight(leg.draft, leg.id, now));
    const broken = chosen.findIndex((_, i) => !ready[i]);
    if (broken >= 0) {
      setMessage(t("flightPhoto.invalid"));
      setLegs(all => all?.map(leg => leg.id === chosen[broken].id ? { ...leg, editing: true } : leg));
      return;
    }
    if (chosen.some(leg => duplicateFlight(leg.draft, existing))) { Alert.alert(t("flightPhoto.duplicate")); return; }
    pending.current = true; setMessage("");
    try {
      const items = ready as Reservation[];
      if (items.length === 1) await onSave(items[0]);
      else await onSaveMany?.(items);
    }
    catch { if (mounted.current) setMessage(t("res.saveError")); }
    finally { pending.current = false; }
  }

  return <View style={{ gap: 16 }}>
    <SolidButton title={t(reading ? "stayPhoto.reading" : legs ? "stayPhoto.replace" : "flightPhoto.pick")} disabled={!canReadReceipts || busy} onPress={() => void pick()} />
    {reading && <ActivityIndicator accessibilityLabel={t("stayPhoto.reading")} color={mono.ink} />}
    {!legs && <Text style={[textRole.meta, { color: mono.gray }]}>{t(canReadReceipts ? "flightPhoto.local" : "stayPhoto.unsupported")}</Text>}
    {!!message && <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.ink }]}>{message}</Text>}
    {legs && <>
      <Text accessibilityRole="header" style={[textRole.sectionTitle, { color: mono.ink }]}>{t("flightPhoto.review")}</Text>
      {legs.length > 1 && <Text style={[textRole.meta, { color: mono.gray }]}>{t("flightPhoto.found", { n: legs.length })}</Text>}
      {legs.map((leg, index) => <LegReview key={leg.id} leg={leg} index={index} multiple={legs.length > 1} initial={initial} existing={existing} disabled={busy}
        onToggle={() => update(index, { include: !leg.include })} onEdit={editing => update(index, { editing })} onField={(key, value) => field(index, key, value)} />)}
      <Text style={[textRole.meta, { color: mono.gray }]}>{t("flightPhoto.confirm")}</Text>
      <SolidButton title={t(saving ? "money.saving" : chosen.length > 1 ? "flightPhoto.saveLegs" : "stayPhoto.save", { n: chosen.length })} disabled={busy || !valid} onPress={() => void save()} />
    </>}
  </View>;
}

function LegReview({ leg, index, multiple, initial, existing, disabled, onToggle, onEdit, onField }: {
  leg: Leg; index: number; multiple: boolean; initial: Reservation; existing: Reservation[]; disabled: boolean;
  onToggle: () => void; onEdit: (editing: boolean) => void; onField: (key: keyof FlightPhotoDraft, value: string) => void;
}) {
  const { t } = useI18n();
  const { draft, editing } = leg;
  const label = t("flightPhoto.leg", { n: index + 1 });
  return <View style={{ gap: 12, paddingTop: multiple ? 12 : 0, borderTopWidth: multiple ? 0.5 : 0, borderColor: mono.rule }}>
    {multiple && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: leg.include, disabled }} accessibilityLabel={`${label}, ${t("flightPhoto.include")}`}
      disabled={disabled} onPress={onToggle} style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.6 : 1 })}>
      <Check done={leg.include} />
      <Text style={[textRole.control, { flex: 1, color: mono.ink }]}>{label}</Text>
      <Text style={[textRole.meta, { color: mono.gray }]}>{t(leg.include ? "flightPhoto.included" : "flightPhoto.excluded")}</Text>
    </Pressable>}
    {duplicateFlight(draft, existing) && <Text style={[textRole.meta, { color: mono.gray }]}>{t("flightPhoto.duplicateLeg")}</Text>}
    {isDateOnly(draft.startDate) && <TransportTicket reservation={{ ...draft, id: leg.id, kind: "flight", updatedAt: initial.updatedAt, endDate: isDateOnly(draft.endDate) ? draft.endDate : undefined, startTime: draft.startTime || undefined, endTime: draft.endTime || undefined }} onOpen={() => onEdit(true)} />}
    <LineButton title={t(editing ? "flightPhoto.hide" : "flightPhoto.edit")} onPress={() => onEdit(!editing)} disabled={disabled} />
    {editing && <View style={{ gap: 18 }}>
      <Field label={t("res.name")} value={draft.title} maxLength={120} editable={!disabled} onChangeText={v => onField("title", v)} />
      <Field label={t("res.service")} value={draft.serviceNumber} maxLength={40} autoCapitalize="characters" editable={!disabled} onChangeText={v => onField("serviceNumber", v)} />
      <Text style={[textRole.sectionTitle, { color: mono.ink }]}>{t("res.depart")}</Text>
      <Field label={t("res.departure")} value={draft.departure} maxLength={120} editable={!disabled} onChangeText={v => onField("departure", v)} />
      <Field label={t("res.startDate")} value={draft.startDate} placeholder="YYYY-MM-DD" maxLength={10} editable={!disabled} onChangeText={v => onField("startDate", v)} />
      <Field label={t("res.time")} value={draft.startTime} placeholder="HH:MM" maxLength={5} editable={!disabled} onChangeText={v => onField("startTime", v)} />
      <TimeZoneSelect label={t("res.zone")} value={draft.timeZone} onChange={v => onField("timeZone", v)} />
      <Text style={[textRole.sectionTitle, { color: mono.ink }]}>{t("res.arrive")}</Text>
      <Field label={t("res.arrival")} value={draft.arrival} maxLength={120} editable={!disabled} onChangeText={v => onField("arrival", v)} />
      <Field label={t("res.endDate")} value={draft.endDate} placeholder="YYYY-MM-DD" maxLength={10} editable={!disabled} onChangeText={v => onField("endDate", v)} />
      <Field label={t("res.endTime")} value={draft.endTime} placeholder="HH:MM" maxLength={5} editable={!disabled} onChangeText={v => onField("endTime", v)} />
      <TimeZoneSelect label={t("res.arrivalZone")} value={draft.endTimeZone} onChange={v => onField("endTimeZone", v)} />
    </View>}
  </View>;
}
