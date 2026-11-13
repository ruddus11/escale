import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import type { PageEntry } from "../data/model";
import { bookingSuggestions, parseHandled, plannedLines, rememberHandled, type Handled, type Suggestion } from "../data/bookingAutofill";
import { todayStore } from "../data/sqlite";
import { useI18n } from "../i18n/I18n";
import { formatDay, type Key } from "../i18n/strings";
import { Check, SectionHead, SolidButton, TextLink } from "../theme/mono";
import { mono, space, stroke, textRole } from "../theme/tokens";

// 완료 안내를 보여 주는 시간(ms).
const NOTICE_MS = 4000;

// 넣음·거절 기록은 기기 설정(today:autofill:<tripId>)에만 둔다. 수첩·백업·동기화에는 넣지 않는다.
// 예약 상세와 계획 탭이 같은 기록을 보므로 한 곳에 두고 바뀌면 둘 다 다시 그린다.
const cache = new Map<string, Handled>();
const loading = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function load(tripId: string) {
  if (cache.has(tripId) || loading.has(tripId)) return;
  loading.add(tripId);
  todayStore
    .get(`autofill:${tripId}`)
    .then(parseHandled, () => ({}))
    .then((handled) => {
      cache.set(tripId, handled);
      loading.delete(tripId);
      emit();
    });
}

function remember(tripId: string, handled: Handled) {
  cache.set(tripId, handled);
  emit();
  // 저장에 실패해도 이번 실행 동안은 묻지 않는다. 다음 실행에서 한 번 더 물을 뿐이다.
  void todayStore.set(`autofill:${tripId}`, JSON.stringify(handled)).catch(() => undefined);
}

/** 기록을 읽기 전에는 undefined. 그동안 카드를 띄우지 않아 거절한 제안이 잠깐 보이지 않게 한다. */
function useHandled(tripId: string): Handled | undefined {
  load(tripId);
  return useSyncExternalStore(subscribe, () => cache.get(tripId));
}

/**
 * "일정에 넣을까요?" 카드. 예약에서 나온 줄을 고르고 넣는다. 아무것도 저장하지 않고 닫을 수도 있다.
 * reservationId를 주면 그 예약의 줄만, 없으면 수첩 전체 예약의 줄을 묻는다. compact(즉흥형)는 한 줄로 접어 둔다.
 */
export function BookingAutofillCard({
  trip,
  pages,
  reservationId,
  compact,
  saving,
  onApply,
}: {
  trip: TripWorkspace;
  pages: readonly PageEntry[];
  reservationId?: string;
  compact?: boolean;
  saving: boolean;
  onApply: (chosen: Suggestion[]) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const handled = useHandled(trip.id);
  const suggestions = handled ? bookingSuggestions(trip, pages, handled, lang, reservationId) : [];
  // 끈 줄의 id. 처음에는 모두 켜 둔다.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(!compact);
  const [notice, setNotice] = useState<Key | "">("");
  const [busy, setBusy] = useState(false);
  // 여행 방식(J/P)을 바꾸면 떠 있는 카드도 펼침·접힘을 따라간다.
  useEffect(() => setOpen(!compact), [compact]);
  // 완료 안내는 잠깐만 보인다. 새 제안이 생기면 바로 지워 지난 결과가 남지 않게 한다.
  const pending = suggestions.map((s) => `${s.id}=${s.signature}`).join(",");
  useEffect(() => {
    if (notice !== "autofill.done" && notice !== "autofill.updated" && notice !== "autofill.applied") return;
    if (pending) {
      setNotice("");
      return;
    }
    const timer = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, pending]);

  if (!handled || !suggestions.length)
    return notice ? (
      <Text accessibilityLiveRegion="polite" style={[textRole.meta, { color: mono.gray }]}>
        {t(notice)}
      </Text>
    ) : null;

  const chosen = suggestions.filter((s) => !off.has(s.id));
  // 제목·버튼 문구: 모두 새 줄이면 "넣기", 모두 바뀐 줄이면 "바꾸기", 섞이면 "넣기·바꾸기".
  const mode = (lines: readonly Suggestion[]) =>
    lines.every((s) => s.state === "changed") ? "update" : lines.some((s) => s.state === "changed") ? "mixed" : "add";
  const cardMode = mode(suggestions);
  const disabled = saving || busy;
  const finish = (next: Handled) => remember(trip.id, rememberHandled(next, suggestions, plannedLines(trip, lang)));

  async function apply() {
    if (!handled || !chosen.length || busy) return;
    setBusy(true);
    try {
      await onApply(chosen);
      finish(handled);
      const done = mode(chosen);
      setNotice(done === "update" ? "autofill.updated" : done === "mixed" ? "autofill.applied" : "autofill.done");
    } catch {
      setNotice("autofill.failed");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    if (!handled) return;
    finish(handled);
    setNotice("");
  }

  const dismissLabel = `${t("autofill.dismiss")}. ${t("autofill.dismissHint")}`;

  if (!open)
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.gutter, borderTopWidth: stroke.button, borderColor: mono.hair }}>
        <Text style={[textRole.meta, { flexShrink: 1, color: mono.ink }]}>{t("autofill.collapsed", { n: suggestions.length })}</Text>
        <TextLink title={t("autofill.show")} label={`${t("autofill.show")}. ${t("autofill.collapsed", { n: suggestions.length })}`} onPress={() => setOpen(true)} />
        <TextLink title={t("autofill.dismiss")} label={dismissLabel} disabled={disabled} onPress={dismiss} />
      </View>
    );

  const when = (line: { date: string; time?: string }) => `${formatDay(lang, line.date)} · ${line.time ?? t("autofill.noTime")}`;
  const all = chosen.length === suggestions.length;
  const action =
    cardMode === "update" ? (all ? t("autofill.updateAll") : t("autofill.updateSome", { n: chosen.length }))
    : cardMode === "mixed" ? (all ? t("autofill.applyAll") : t("autofill.applySome", { n: chosen.length }))
    : all ? t("autofill.addAll") : t("autofill.addSome", { n: chosen.length });
  const heading = cardMode === "update" ? "autofill.changedTitle" : cardMode === "mixed" ? "autofill.mixedTitle" : "autofill.title";
  const sub = cardMode === "update" ? "autofill.changedSub" : cardMode === "mixed" ? "autofill.mixedSub" : "autofill.sub";

  return (
    <View style={{ gap: space.group }}>
      <View style={{ gap: 4 }}>
        <SectionHead title={t(heading)} />
        <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t(sub)}</Text>
      </View>
      <View>
        {suggestions.map((s) => {
          const on = !off.has(s.id);
          // 바뀐 줄은 전과 지금을 함께 적는다. 날짜가 같으면 시각만.
          const detail = s.state === "changed" && s.previous
            ? `${formatDay(lang, s.date)} · ${t("autofill.changed", {
                from: s.previous.date === s.date ? s.previous.time ?? t("autofill.noTime") : when(s.previous),
                to: s.time ?? t("autofill.noTime"),
              })}`
            : when(s);
          return (
            <Pressable
              key={s.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={t("autofill.rowA11y", { title: s.title, when: detail })}
              disabled={disabled}
              onPress={() =>
                setOff((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: space.touch, paddingVertical: 10, borderBottomWidth: stroke.button, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ marginTop: 3 }}>
                <Check done={on} size={18} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[textRole.itemTitle, { color: on ? mono.ink : mono.gray }]}>{s.title}</Text>
                <Text style={[textRole.meta, { color: mono.gray, fontVariant: ["tabular-nums"] }]}>{detail}</Text>
                {!!s.body && <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{s.body}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
      {notice === "autofill.failed" && (
        <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.warn }]}>
          {t(notice)}
        </Text>
      )}
      <SolidButton title={action} disabled={disabled || !chosen.length} onPress={() => void apply()} />
      <TextLink title={t("autofill.dismiss")} label={dismissLabel} disabled={disabled} onPress={dismiss} style={{ alignSelf: "center" }} />
    </View>
  );
}
