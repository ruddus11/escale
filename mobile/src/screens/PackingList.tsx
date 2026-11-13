import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { PackingItem } from "../data/model";
import { packingSuggestions } from "../data/packingRules";
import { notebookRepository } from "../data/sqlite";
import { useI18n } from "../i18n/I18n";
import { ChapterHeading } from "../components/ChapterHeading";
import { Check, EmptyState, IconButton, SolidButton, TextLink, UnderlineTabs } from "../theme/mono";
import { diary, mono, space, stroke, textRole } from "../theme/tokens";

type Props = {
  items: PackingItem[];
  saving: boolean;
  onToggle: (id: string, done: boolean) => Promise<void>;
  onAdd: (title: string) => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
  onRename?: (item: PackingItem, title: string) => Promise<void>;
  trip?: TripWorkspace;
  history?: PackingItem[];
  historyReady?: boolean;
};

/** 현재 목록을 유지하면서 빠진 제안만 넣고, 각 줄의 체크·이름·삭제를 기존 저장 경로로 보낸다. */
export function PackingList({ items, saving, onToggle, onAdd, onRemove, onRename, trip, history = [], historyReady = true }: Props) {
  const { t, lang } = useI18n();
  const stacked = useWindowDimensions().fontScale > 1.4;
  const [filter, setFilter] = useState<"all" | "left" | "done">("all");
  const [text, setText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedTrip, setLoadedTrip] = useState<TripWorkspace | undefined>();
  const [loadedHistory, setLoadedHistory] = useState<PackingItem[]>([]);
  useEffect(() => {
    if (trip) return;
    let active = true;
    void notebookRepository.load().then((data) => {
      const current = data.library.trips.find((book) => book.id === (items[0]?.tripId ?? data.library.activeTripId));
      if (!current || !active) return;
      const past = new Set(data.library.trips.filter((book) => book.id !== current.id && book.settings.endDate < current.settings.startDate).map((book) => book.id));
      setLoadedTrip(current);
      setLoadedHistory((data.packing ?? []).filter((item) => past.has(item.tripId)));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [trip, items[0]?.tripId]);
  const locked = saving || busy;
  const left = items.filter((item) => !item.done).length;
  const visible = items.filter((item) => filter === "all" || (filter === "done" ? item.done : !item.done));
  const currentTrip = trip ?? loadedTrip;
  const suggested = currentTrip ? packingSuggestions(currentTrip.settings, lang, items, trip ? history : loadedHistory, currentTrip.id) : [];
  async function change(action: () => Promise<void>) {
    if (locked) return;
    setBusy(true);
    try { await action(); }
    catch { Alert.alert(t("kit.saveError")); }
    finally { setBusy(false); }
  }
  function add() {
    const title = text.trim().replace(/\s+/g, " ");
    if (!title || items.length >= 200) return;
    void change(async () => { await onAdd(title); setText(""); });
  }
  function remove(item: PackingItem) {
    if (!onRemove) return;
    Alert.alert(t("kit.deleteTitle"), item.title, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("kit.delete"), style: "destructive", onPress: () => void change(() => onRemove(item.id)) },
    ]);
  }
  function rename(item: PackingItem) {
    const title = editText.trim().replace(/\s+/g, " ");
    if (!onRename || !title || title === item.title) { setEditId(null); return; }
    void change(async () => { await onRename(item, title); setEditId(null); });
  }
  return <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.gutter, gap: 20, paddingBottom: 48 }}>
    <ChapterHeading title={t("pack.title")} sub={t("pack.progress", { n: items.length, done: items.length - left })} />
    {!!currentTrip && <View style={{ gap: space.group, paddingBottom: space.group, borderBottomWidth: stroke.button, borderColor: mono.hair }}>
      <Text style={[textRole.sectionTitle, { color: mono.ink }]}>{t("autoPack.title")}</Text>
      <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("autoPack.note")}</Text>
      {!historyReady ? <Text style={[textRole.meta, { color: mono.gray }]}>{t("autoPack.loading")}</Text> : suggested.length ? <SolidButton title={t("autoPack.add", { n: suggested.length })} disabled={locked} onPress={() => void change(async () => { for (const title of suggested) await onAdd(title); })} /> : <Text style={[textRole.meta, { color: mono.gray }]}>{t("autoPack.none")}</Text>}
    </View>}
    <UnderlineTabs items={(["all", "left", "done"] as const).map((key) => ({ key, title: t(`pack.filter.${key}`), count: key === "all" ? items.length : key === "left" ? left : items.length - left }))} value={filter} onChange={setFilter} />
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: stroke.button, borderColor: diary.silver }}>
      <TextInput accessibilityLabel={t("pack.add")} placeholder={t("pack.add")} placeholderTextColor={mono.gray} value={text} onChangeText={setText} editable={!locked} maxLength={120} returnKeyType="done" style={[textRole.body, { flex: 1, minHeight: 50, color: mono.ink }]} onSubmitEditing={add} />
      <IconButton icon="plus" label={t("pack.add")} disabled={locked || !text.trim() || items.length >= 200} onPress={add} />
    </View>
    <View>{visible.map((item) => <View key={item.id} style={{ borderBottomWidth: stroke.button, borderColor: diary.edge, paddingVertical: 6 }}>
      {editId === item.id ? <View style={{ flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "center", gap: 8 }}>
        <TextInput accessibilityLabel={t("autoPack.edit")} value={editText} onChangeText={setEditText} maxLength={120} editable={!locked} onSubmitEditing={() => rename(item)} style={[textRole.body, { flex: 1, minHeight: 44, color: mono.ink, borderBottomWidth: stroke.button, borderColor: mono.ink }]} />
        <TextLink title={t("common.save")} disabled={locked || !editText.trim()} onPress={() => rename(item)} />
        <TextLink title={t("common.cancel")} onPress={() => setEditId(null)} />
      </View> : <View style={{ flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "center", gap: 8 }}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={item.title} accessibilityState={{ checked: item.done, disabled: locked }} disabled={locked} onPress={() => void change(() => onToggle(item.id, !item.done))} style={({ pressed }) => ({ flex: 1, flexDirection: "row", gap: 14, alignItems: "center", minHeight: 48, opacity: pressed ? 0.6 : 1 })}><Check size={22} done={item.done} /><Text style={[textRole.body, { flex: 1, color: item.done ? mono.gray : mono.ink }]}>{item.title}</Text></Pressable>
        {/* 줄마다 반복되는 보조 행동이라 회색 아이콘으로 낮춘다. 삭제의 위험 표시는 확인 창이 맡고, 읽기 라벨에 물건 이름을 넣어 줄을 구분한다. */}
        {(onRename || onRemove) && <View style={{ flexDirection: "row" }}>
          {!!onRename && <IconButton finish="quiet" icon="pen" label={t("autoPack.rename", { item: item.title })} disabled={locked} onPress={() => { setEditId(item.id); setEditText(item.title); }} />}
          {!!onRemove && <IconButton finish="quiet" icon="close" label={t("autoPack.remove", { item: item.title })} disabled={locked} onPress={() => remove(item)} />}
        </View>}
      </View>}
    </View>)}</View>
    {!visible.length && <EmptyState text={t("pack.emptyFilter")} action={filter === "all" ? undefined : { title: t("pack.filter.all"), onPress: () => setFilter("all") }} />}
  </ScrollView>;
}
