import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { PageEntry } from "../data/model";
import type { PaperStyle } from "../data/notebookDesign";
import { journalHeading, prepareJournal } from "../data/journal";
import { isTripSummaryPage, replaceSummaryText, summaryPageContent } from "../data/tripSummary";
import { JournalPaper, journalType } from "../components/JournalPaper";
import { TextAction, s } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { formatDay } from "../i18n/strings";
import { Icon, IconButton, TopBar } from "../theme/mono";
import { diary, mono, space, textRole } from "../theme/tokens";

export function JournalEditor({ initial, paper, saving, onSave, onCancel }: {
  initial: PageEntry; paper: PaperStyle; saving: boolean;
  onSave: (page: PageEntry) => Promise<void>; onCancel: () => void;
}) {
  const { t, lang } = useI18n();
  // 중복 제목은 화면에서만 감춘다. 출처를 알 수 없는 기존 제목을 저장값에서 지우지 않는다.
  const [value, setValue] = useState(() => isTripSummaryPage(initial) ? { ...initial, body: summaryPageContent(initial.body).text } : initial);
  const [showTitle, setShowTitle] = useState(!!journalHeading(initial));
  const [showDate, setShowDate] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(288);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const busy = saving || submitting;
  const canSave = !!(value.title.trim() || value.body.trim());
  const titleVisible = showTitle || (!value.body.trim() && !!value.title.trim());

  async function save() {
    if (pending.current || saving) return;
    const page = prepareJournal(isTripSummaryPage(initial) ? { ...value, body: replaceSummaryText(initial.body, value.body) } : value);
    if (!page) return;
    pending.current = true;
    setSubmitting(true);
    setError("");
    try { await onSave(page); }
    catch { setError(t("editor.saveError")); }
    finally { pending.current = false; setSubmitting(false); }
  }

  return <View style={{ flex: 1 }}>
    <TopBar
      left={<IconButton finish="silver" icon="back" label={t("common.back")} disabled={busy} onPress={onCancel} />}
      center={<Text style={[textRole.control, { color: mono.ink, fontWeight: "400" }]}>{t("tab.stories")}</Text>}
      right={busy ? <ActivityIndicator accessibilityLabel={t("money.saving")} color={mono.ink} /> : <TextAction title={t("journal.save")} disabled={!canSave} onPress={() => void save()} />}
    />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.gutter, paddingTop: 10, paddingBottom: 32, gap: 18 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: .5, borderColor: diary.silver }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t("editor.date")}, ${formatDay(lang, value.date)}`} accessibilityState={{ expanded: showDate, disabled: busy }} disabled={busy} onPress={() => setShowDate(!showDate)} style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? .6 : 1 })}>
          <Text style={[textRole.meta, { color: mono.gray, flexShrink: 1 }]}>{formatDay(lang, value.date)}</Text><Icon name={showDate ? "up" : "down"} size={14} />
        </Pressable>
        {!titleVisible && <TextAction title={t("journal.addTitle")} disabled={busy} onPress={() => setShowTitle(true)} />}
      </View>
      {showDate && <View>
        <DateTimePicker value={new Date(`${value.date}T12:00:00`)} mode="date" display={Platform.OS === "ios" ? "inline" : "default"} locale={lang} disabled={busy} onChange={(event, picked) => {
          if (Platform.OS !== "ios") setShowDate(false);
          if (event.type === "set" && picked) setValue(v => ({ ...v, date: `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, "0")}-${String(picked.getDate()).padStart(2, "0")}` }));
        }} />
        {Platform.OS === "ios" && <TextAction title={t("ui.dateDone")} disabled={busy} onPress={() => setShowDate(false)} />}
      </View>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {titleVisible && <TextInput accessibilityLabel={t("editor.title")} placeholder={t("journal.optionalTitle")} placeholderTextColor={mono.gray} editable={!busy} value={value.title} onChangeText={title => setValue(v => ({ ...v, title }))} maxLength={120} multiline scrollEnabled={false} style={[journalType.heading, { padding: 0, minHeight: 48, textAlignVertical: "top" }]} />}
      <JournalPaper paper={paper} fill>
        <TextInput accessibilityLabel={t("editor.story")} placeholder={t("journal.write")} placeholderTextColor={mono.gray} editable={!busy} value={value.body} onChangeText={body => { setValue(v => ({ ...v, body })); setError(""); }} maxLength={isTripSummaryPage(initial) ? 1500 : 2000} multiline scrollEnabled={false} onContentSizeChange={event => setBodyHeight(Math.max(288, event.nativeEvent.contentSize.height))} style={[journalType.body, { flexGrow: 1, padding: 0, minHeight: bodyHeight, textAlignVertical: "top" }]} />
      </JournalPaper>
    </ScrollView>
  </View>;
}
