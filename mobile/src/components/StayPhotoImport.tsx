import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { deleteCacheCopies } from "../data/photoFiles";
import { canReadReceipts, readReceiptLines } from "../../modules/receipt-text";
import type { Reservation } from "../../../src/domain/reservations/types";
import { validateReservation } from "../../../src/domain/reservations/reservations";
import { duplicateStay, parseStayPhoto, type StayPhotoDraft } from "../data/stayPhoto";
import { useI18n } from "../i18n/I18n";

import { SolidButton } from "../theme/mono";
import { diary, mono, textRole } from "../theme/tokens";

/** 원본과 OCR 원문은 저장하지 않고 확인한 숙소명·날짜만 기존 예약 저장 경로로 넘긴다. */
export function StayPhotoImport({ initial, existing, saving, onSave }: {
  initial: Reservation; existing: Reservation[]; saving: boolean; onSave: (value: Reservation) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<StayPhotoDraft>();
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function pick() {
    if (pending.current || saving) return;
    pending.current = true;
    let uri: string | undefined;
    setMessage("");
    setReading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, exif: false, allowsMultipleSelection: false });
      if (result.canceled) return;
      // 새 사진을 선택한 뒤에는 이전 예약을 실수로 저장할 수 없게 비운다.
      if (mounted.current) setDraft(undefined);
      uri = result.assets[0]?.uri;
      if (!uri) throw new Error("No image");
      const next = parseStayPhoto(await readReceiptLines(uri));
      if (mounted.current) {
        setDraft(next);
        if (!next.title || !next.startDate || !next.endDate) setMessage(t("stayPhoto.missing"));
      }
    } catch {
      if (mounted.current) setMessage(t("stayPhoto.failed"));
    } finally {
      // 사진 선택기가 만든 캐시 사본만 정리한다. 사용자의 사진 보관함은 건드리지 않는다.
      deleteCacheCopies([uri]);
      pending.current = false;
      if (mounted.current) setReading(false);
    }
  }

  async function save() {
    if (!draft || pending.current || saving) return;
    const next: Reservation = { id: initial.id, kind: "stay", title: draft.title.trim(), startDate: draft.startDate.trim(), endDate: draft.endDate.trim(), timeZone: initial.timeZone, updatedAt: new Date().toISOString() };
    if (!next.endDate || validateReservation(next).length || next.endDate <= next.startDate) {
      setMessage(t("stayPhoto.invalid")); return;
    }
    if (duplicateStay(draft, existing)) { Alert.alert(t("stayPhoto.duplicate")); return; }
    pending.current = true;
    setMessage("");
    try { await onSave(next); } catch { if (mounted.current) setMessage(t("res.saveError")); }
    finally { pending.current = false; }
  }

  return <View style={{ gap: 18 }}>
    <SolidButton title={t(reading ? "stayPhoto.reading" : draft ? "stayPhoto.replace" : "stayPhoto.pick")} onPress={() => void pick()} disabled={!canReadReceipts || reading || saving} />
    {reading && <ActivityIndicator accessibilityLabel={t("stayPhoto.reading")} color={mono.ink} />}
    {!draft && <Text style={[textRole.meta, { color: mono.gray }]}>{t(canReadReceipts ? "stayPhoto.local" : "stayPhoto.unsupported")}</Text>}
    {draft && <View style={{ gap: 16, padding: 18, borderRadius: diary.radius, backgroundColor: diary.surface }}>
      <Text accessibilityRole="header" style={[textRole.sectionTitle, { color: mono.ink }]}>{t("stayPhoto.review")}</Text>
      <ReviewField label={t("res.name")} value={draft.title} maxLength={120} onChangeText={title => setDraft({ ...draft, title })} />
      <ReviewField label={t("res.checkInDate")} placeholder="YYYY-MM-DD" value={draft.startDate} maxLength={10} onChangeText={startDate => setDraft({ ...draft, startDate })} />
      <ReviewField label={t("res.checkOutDate")} placeholder="YYYY-MM-DD" value={draft.endDate} maxLength={10} onChangeText={endDate => setDraft({ ...draft, endDate })} />
      <Text style={[textRole.meta, { color: mono.gray }]}>{initial.timeZone}</Text>
      <SolidButton title={t(saving ? "money.saving" : "stayPhoto.save")} onPress={() => void save()} disabled={reading || saving || !draft.title.trim() || !draft.startDate || !draft.endDate} />
    </View>}
    {!!message && <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.ink }]}>{message}</Text>}
  </View>;
}

function ReviewField({ label, value, placeholder, maxLength, onChangeText }: {
  label: string; value: string; placeholder?: string; maxLength: number; onChangeText: (text: string) => void;
}) {
  return <View style={{ gap: 8 }}>
    <Text style={[textRole.meta, { color: mono.gray }]}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} placeholder={placeholder} placeholderTextColor={mono.gray} maxLength={maxLength} onChangeText={onChangeText} autoCorrect={false} style={{ minHeight: 48, ...textRole.body, color: mono.ink, borderBottomWidth: 1, borderColor: mono.hair, paddingVertical: 10 }} />
  </View>;
}
