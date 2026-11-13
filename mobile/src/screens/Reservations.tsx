import { FlightPhotoImport } from "../components/FlightPhotoImport";
import { StayPhotoImport } from "../components/StayPhotoImport";
import { TimeZoneSelect } from "../components/SearchSelect";
import { PasteImport } from "../components/PasteImport";
import { fillReservation } from "../data/confirmationImport";
import { paidBuild, type PremiumSettings } from "../data/premium";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Alert, Linking, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import type { Reservation, ReservationKind } from "../../../src/domain/reservations/types";
import { reservationServiceUrl, validateReservation } from "../../../src/domain/reservations/reservations";
import { Button, Caption, Choices, DateField, Field, Sheet, TimeField, Title, s } from "../components/ui";
import { translateNow, useI18n } from "../i18n/I18n";
import { formatDay, type Key } from "../i18n/strings";
import { Icon, IconButton, LineButton, TextLink, UnderlineTabs } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";
import { zoneCity } from "../data/selectionOptions";

// "복사했어요"를 보여 주는 시간(ms). 짧은 성공 안내라 눌러서 닫는 창을 띄우지 않는다.
const COPIED_MS = 1500;

export const reservationKindKey: Record<ReservationKind, Key> = {
  stay: "res.kind.stay",
  flight: "res.kind.flight",
  transport: "res.kind.transport",
  activity: "res.kind.activity",
};

// 공용 검사(validateReservation)는 웹과 같이 쓰는 한국어 문장을 돌려준다. 앱에서는 사전 키로 바꿔 보인다.
const ISSUE_KEYS: Record<string, Key> = {
  "예약 이름을 입력해 주세요.": "res.issue.title",
  "시작 날짜를 확인해 주세요.": "res.issue.start",
  "현지 시간대를 확인해 주세요.": "res.issue.zone",
  "시작 시각을 확인해 주세요.": "res.issue.startTime",
  "종료 날짜를 확인해 주세요.": "res.issue.end",
  "종료 시각과 날짜를 함께 확인해 주세요.": "res.issue.endTime",
  "예약 서비스의 https 홈페이지 주소만 넣어 주세요. 개별 예약 링크는 저장하지 않아요.": "res.issue.url",
  "주소와 메모의 길이를 확인해 주세요.": "res.issue.length",
  "종료는 시작 이후여야 해요. 현지 날짜와 시간대를 확인해 주세요.": "res.issue.order",
  "종료 날짜가 더 이르면 출발·도착 시각과 시간대를 모두 입력해 주세요.": "res.issue.orderDates",
  "현지 시간 변경으로 없거나 두 번 나타나는 시각이에요. 예약 원본의 시각을 확인해 주세요.": "res.issue.dst",
};

export function newReservation(timeZone: string, date: string): Reservation {
  return {
    id: randomUUID(),
    kind: "stay",
    title: "",
    startDate: date,
    timeZone,
    updatedAt: new Date().toISOString(),
  };
}

export async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(translateNow("res.linkFailed"), translateNow("res.linkFailedBody"));
  }
}

export function ReservationForm({
  initial,
  existing = [],
  onSave,
  onSaveMany,
  onCancel,
  saving,
  premium,
  onPremiumChange,
}: {
  initial: Reservation;
  existing?: Reservation[];
  onSave: (r: Reservation) => Promise<void>;
  onSaveMany?: (rs: Reservation[]) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  premium?: PremiumSettings;
  onPremiumChange?: (next: PremiumSettings) => void;
}) {
  const { t } = useI18n();
  const pending = useRef(false);
  const [manual, setManual] = useState(!!initial.title);
  const [photoKind, setPhotoKind] = useState<"stay" | "flight">("stay");
  const [value, setValue] = useState(initial),
    [errors, setErrors] = useState<string[]>([]),
    [extra, setExtra] = useState(false);
  const stay = value.kind === "stay",
    transport = value.kind === "flight" || value.kind === "transport";
  const field = (key: keyof Reservation, text: string) => setValue((v) => ({ ...v, [key]: text || undefined }));
  async function submit() {
    if (pending.current || saving) return;
    const next = {
      ...value,
      title: (value.title ?? "").trim(),
      updatedAt: new Date().toISOString(),
      verifiedAt: undefined,
    };
    const issues = validateReservation(next);
    setErrors(issues.map((issue) => (ISSUE_KEYS[issue] ? t(ISSUE_KEYS[issue]) : issue)));
    if (issues.length) return;
    pending.current = true;
    try {
      await onSave({
        ...next,
        sourceUrl: next.sourceUrl ? reservationServiceUrl(next.sourceUrl) : undefined,
      });
    } catch {
      setErrors([t("res.saveError")]);
    } finally {
      pending.current = false;
    }
  }
  if (!manual) return (
    <Sheet>
      <Title>{t("res.new")}</Title>
      <UnderlineTabs items={(["stay", "flight"] as const).map((kind) => ({ key: kind, title: t(reservationKindKey[kind]) }))} value={photoKind} onChange={setPhotoKind} disabled={saving} />
      {photoKind === "flight" ? <FlightPhotoImport initial={initial} existing={existing} saving={saving} onSave={onSave} onSaveMany={onSaveMany} />
        : <StayPhotoImport initial={initial} existing={existing} saving={saving} onSave={onSave} />}
      <LineButton title={t("stayPhoto.manual")} disabled={saving} onPress={() => { setValue(v => ({...v,kind:photoKind})); setManual(true); }} />
      <LineButton title={t("common.cancel")} disabled={saving} onPress={onCancel} />
    </Sheet>
  );
  return (
    <Sheet>
      <Title>{t(initial.title ? "res.edit" : "res.new")}</Title>
      {paidBuild.paid && !initial.title && premium && onPremiumChange && (
        <PasteImport
          year={Number(initial.startDate.slice(0, 4))}
          premium={premium}
          onPremiumChange={onPremiumChange}
          onFill={(extracted) => setValue((v) => fillReservation(v, extracted))}
        />
      )}
      <Choices
        value={value.kind}
        choices={(Object.keys(reservationKindKey) as ReservationKind[]).map((kind) => ({ value: kind, label: t(reservationKindKey[kind]) }))}
        onChange={(kind) => setValue((v) => ({ ...v, kind }))}
      />
      <Field
        label={t("res.name")}
        value={value.title}
        maxLength={120}
        onChangeText={(text) => field("title", text)}
        placeholder={t(stay ? "res.namePlaceholderStay" : "res.namePlaceholder")}
      />
      <DateField label={t(stay ? "res.checkInDate" : "res.startDate")} value={value.startDate} onChange={(text) => field("startDate", text)} />
      <TimeField label={t("res.time")} value={value.startTime ?? ""} onChange={(text) => field("startTime", text)} />
      <TimeZoneSelect label={t("res.zone")} value={value.timeZone} onChange={(text) => field("timeZone", text)} />
      {value.endDate ? (
        <>
          <DateField label={t(stay ? "res.checkOutDate" : "res.endDate")} value={value.endDate} onChange={(text) => field("endDate", text)} />
          <TimeField label={t("res.endTime")} value={value.endTime ?? ""} onChange={(text) => field("endTime", text)} />
          {transport && <TimeZoneSelect label={t("res.arrivalZone")} value={value.endTimeZone ?? value.timeZone} onChange={(text) => field("endTimeZone", text)} />}
          <Button
            title={t("res.clearEnd")}
            quiet
            onPress={() => setValue((v) => ({ ...v, endDate: undefined, endTime: undefined, endTimeZone: undefined }))}
          />
        </>
      ) : (
        <Button title={t(stay ? "res.addCheckOut" : "res.addEnd")} icon="plus" quiet onPress={() => field("endDate", value.startDate)} />
      )}
      {transport ? (
        <>
          <Field label={t("res.departure")} value={value.departure ?? ""} maxLength={120} onChangeText={(text) => field("departure", text)} />
          <Field label={t("res.arrival")} value={value.arrival ?? ""} maxLength={120} onChangeText={(text) => field("arrival", text)} />
          <Field label={t("res.service")} value={value.serviceNumber ?? ""} maxLength={40} onChangeText={(text) => field("serviceNumber", text)} />
        </>
      ) : (
        <Field label={t(stay ? "res.addressStay" : "res.address")} value={value.address ?? ""} maxLength={300} onChangeText={(text) => field("address", text)} />
      )}
      <Button title={t(extra ? "res.less" : "res.more")} icon={extra ? "up" : "down"} quiet onPress={() => setExtra(!extra)} />
      {extra && (
        <>
          <Field label={t("res.note")} multiline value={value.note ?? ""} maxLength={400} onChangeText={(text) => field("note", text)} />
          <Field
            label={t("res.site")}
            placeholder="https://example.com"
            autoCapitalize="none"
            keyboardType="url"
            value={value.sourceUrl ?? ""}
            maxLength={500}
            onChangeText={(text) => field("sourceUrl", text)}
          />
        </>
      )}
      <Caption>{t("res.privacy")}</Caption>
      {errors.map((e) => (
        <Text key={e} accessibilityRole="alert" style={s.error}>
          {e}
        </Text>
      ))}
      <Button title={t(saving ? "money.saving" : "res.save")} disabled={saving} onPress={() => void submit()} />
      <Button title={t("common.cancel")} quiet disabled={saving} onPress={onCancel} />
    </Sheet>
  );
}

// 예약 한 건. 탑승권처럼 위에 종류와 이름, 가운데 출발·도착(체크인·아웃) 칸, 아래에 주소와 확인.
export function ReservationDetails({
  item,
  onEdit,
  onVerify,
  onRemove,
  saving,
  autofill,
}: {
  item: Reservation;
  onEdit: () => void;
  onVerify: () => void;
  onRemove: () => void;
  saving: boolean;
  /** 저장한 예약으로 일정을 채울지 묻는 카드. 출발·도착 칸 바로 아래에 둔다. */
  autofill?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  // 버튼 글자가 바뀌는 것만으로는 화면 읽기 프로그램이 알려 주지 않아 따로 읽어 준다.
  function copyAddress() {
    void Clipboard.setStringAsync(item.address!)
      .then(() => {
        setCopied(true);
        AccessibilityInfo.announceForAccessibility(t("res.copied"));
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
      })
      .catch(() => Alert.alert(t("res.copyFailed")));
  }
  const stay = item.kind === "stay";
  const mapUrl = item.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}` : "";
  const end = (label: Key, date: string | undefined, time: string | undefined, zone: string, place?: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[textRole.meta, { color: mono.gray }]}>{t(label)}</Text>
      {time ? (
        <Text style={[textRole.feature, { color: mono.ink }]}>{time}</Text>
      ) : (
        <Text style={[textRole.meta, { lineHeight: 38, color: mono.gray }]}>{t("res.noTime")}</Text>
      )}
      {!!date && <Text style={[textRole.itemTitle, { color: mono.ink }]}>{formatDay(lang, date)}</Text>}
      <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{[place, t("res.zoneTime", { city: zoneCity(zone, lang) })].filter(Boolean).join(" · ")}</Text>
    </View>
  );
  // 칸 이름은 예약 종류에 맞춘다: 숙소는 체크인·아웃, 이동은 출발·도착, 입장·체험은 시작·끝.
  const [startLabel, endLabel]: [Key, Key] = stay ? ["pouch.checkIn", "pouch.checkOut"] : item.kind === "activity" ? ["res.start", "res.end"] : ["res.depart", "res.arrive"];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 14, paddingBottom: 48, gap: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[textRole.meta, { color: mono.gray }]}>{[t(reservationKindKey[item.kind]), item.serviceNumber].filter(Boolean).join(" · ")}</Text>
          <Text selectable lineBreakStrategyIOS="hangul-word" style={[textRole.pageTitle, { color: mono.ink }]}>
            {item.title}
          </Text>
        </View>
        <IconButton icon="pen" label={t("res.edit")} disabled={saving} onPress={onEdit} />
      </View>

      <View style={{ flexDirection:"row",gap:16,paddingVertical:18,borderTopWidth:1,borderBottomWidth:1,borderColor:mono.hair }}>
        {end(startLabel, item.startDate, item.startTime, item.timeZone, item.departure)}
        {!!item.endDate && <View style={{ width: 1, backgroundColor: mono.hair }} />}
        {!!item.endDate && end(endLabel, item.endDate, item.endTime, item.endTimeZone ?? item.timeZone, item.arrival)}
      </View>
      {autofill}

      {!!item.address && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Icon name="pin" />
            <Text selectable style={[textRole.body, { flex: 1, color: mono.ink }]}>
              {item.address}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <LineButton title={t(copied ? "res.copied" : "res.copy")} style={{ flex: 1, minHeight: 44 }} onPress={copyAddress} />
            <LineButton title={t("res.openMap")} style={{ flex: 1, minHeight: 44 }} onPress={() => void openLink(mapUrl)} />
          </View>
        </View>
      )}
      {!!item.note && (
        <Text selectable style={[textRole.body, { color: mono.ink }]}>
          {item.note}
        </Text>
      )}
      {!!item.sourceUrl && <LineButton title={t("res.openSite")} onPress={() => void openLink(item.sourceUrl!)} />}

      <Text style={[textRole.meta, { color: mono.gray }]}>
        {[item.verifiedAt && t("res.verifiedAt", { time: new Date(item.verifiedAt).toLocaleString(lang) }), t("res.noAutoUpdate")].filter(Boolean).join(" · ")}
      </Text>
      <TextLink title={t("res.verify")} disabled={saving} onPress={onVerify} style={{ alignSelf: "center" }} />
      <TextLink
        tone="danger"
        title={t("res.remove")}
        disabled={saving}
        style={{ alignSelf: "center" }}
        onPress={() =>
          Alert.alert(t("res.removeTitle"), t("res.removeBody"), [
            { text: t("common.keep"), style: "cancel" },
            { text: t("common.delete"), style: "destructive", onPress: onRemove },
          ])
        }
      />
    </ScrollView>
  );
}
