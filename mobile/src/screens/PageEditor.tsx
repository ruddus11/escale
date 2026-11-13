import { useState } from "react";
import { Text, View } from "react-native";
import type { PageEntry } from "../data/model";
import { Button, Choices, DateField, Field, Label, Sheet, Title, s } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { formatDuration } from "../i18n/strings";
import { PlaceSearch } from "../components/PlaceSearch";
import { TextLink } from "../theme/mono";
import { mono, textRole } from "../theme/tokens";
import type { PaperStyle } from "../data/notebookDesign";
import { JournalEditor } from "./JournalEditor";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// 머무는 시간 고르기. "모름"이면 빈 시간·여유를 계산하지 않는다.
// 숫자 키는 객체 순서가 바뀌므로 배열로 순서를 고정한다.
const STAY = ["none", "30", "60", "90", "120", "180"] as const;
type StayValue = (typeof STAY)[number];
type PageEditorProps = {
  initial: PageEntry;
  paper?: PaperStyle;
  saving: boolean;
  onSave: (page: PageEntry) => Promise<void>;
  onCancel: () => void;
};

export function PageEditor(props: PageEditorProps) {
  return props.initial.kind === "journal"
    ? <JournalEditor {...props} paper={props.paper ?? "ruled"} />
    : <StructuredPageEditor {...props} />;
}

function StructuredPageEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: PageEditorProps) {
  const { t, lang } = useI18n();
  const [value, setValue] = useState(initial),
    [error, setError] = useState("");
  const stayChoices = STAY.map((v) => ({ value: v, label: v === "none" ? t("editor.stayUnknown") : formatDuration(lang, Number(v)) }));
  async function save() {
    if (!value.title.trim()) {
      setError(t("editor.needTitle"));
      return;
    }
    const time = value.time?.trim();
    if (time && !TIME.test(time)) {
      setError(t("editor.badTime"));
      return;
    }
    const { time: _t, minutes: _m, ...rest } = value;
    try {
      await onSave({ ...rest, title: value.title.trim(), ...(time ? { time } : {}), ...(time && value.minutes ? { minutes: value.minutes } : {}) });
    } catch {
      setError(t("editor.saveError"));
    }
  }
  return (
    <Sheet>
      <Title>{t(value.kind === "plan" ? "editor.plan" : value.kind === "place" ? "editor.place" : "editor.journal")}</Title>
      {value.kind !== "journal" && (
        // 장소를 고르면 이름(비어 있을 때만)·주소·장소 ID가 채워지고, 계획 탭 지도에 핀으로 보인다.
        <PlaceSearch
          onPick={(place) =>
            setValue((v) => ({ ...v, title: v.title.trim() ? v.title : place.name.slice(0, 120), address: place.address.slice(0, 300), placeId: place.placeId }))
          }
        />
      )}
      <Field
        label={t("editor.title")}
        value={value.title}
        onChangeText={(title) => setValue((v) => ({ ...v, title }))}
        maxLength={120}
      />
      <DateField
        label={t(value.kind === "place" ? "editor.datePlace" : "editor.date")}
        value={value.date}
        onChange={(date) => setValue((v) => ({ ...v, date }))}
      />
      {value.kind === "plan" && (
        <>
          <Field
            label={t("editor.time")}
            value={value.time ?? ""}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            onChangeText={(time) => setValue((v) => ({ ...v, time }))}
          />
          {!!value.time && (
            <View style={{ gap: 8 }}>
            <Label>{t("editor.stay")}</Label>
            <Choices
              value={(STAY.some((c) => c === String(value.minutes)) ? String(value.minutes) : "none") as StayValue}
              choices={stayChoices}
              onChange={(v) => setValue((cur) => ({ ...cur, minutes: v === "none" ? undefined : Number(v) }))}
            />
            </View>
          )}
        </>
      )}
      {value.kind !== "journal" && (
        <View>
          <Field
            label={t("editor.address")}
            value={value.address}
            // 주소를 손으로 고치면 고른 장소와 달라질 수 있어 장소 ID를 뗀다. 지도는 적은 주소로 찾는다.
            onChangeText={(address) => setValue(({ placeId: _placeId, ...v }) => ({ ...v, address }))}
            maxLength={300}
          />
          {!!value.placeId && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[textRole.meta, { flex: 1, color: mono.gray }]}>{t("place.picked")}</Text>
              <TextLink title={t("place.clear")} onPress={() => setValue(({ placeId: _placeId, ...v }) => v)} />
            </View>
          )}
        </View>
      )}
      <Field
        label={t(value.kind === "journal" ? "editor.story" : "editor.memo")}
        value={value.body}
        multiline
        onChangeText={(body) => setValue((v) => ({ ...v, body }))}
        maxLength={2000}
      />
      {error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <Button
        title={t(saving ? "money.saving" : "editor.save")}
        disabled={saving}
        onPress={() => void save()}
      />
      <Button title={t("common.cancel")} quiet disabled={saving} onPress={onCancel} />
    </Sheet>
  );
}
