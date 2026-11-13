import { TripPreview } from "../components/TripPreview";
import { useState } from "react";
import { Pressable,ScrollView,Text,TextInput,View } from "react-native";
import type { TripLibrary,TripWorkspace } from "../../../src/domain/workspace/types";
import { notebookDay } from "../data/notebookView";
import { selectFeaturedTrip } from "../data/libraryStart";
import { useI18n } from "../i18n/I18n";
import { formatDateRange,translate,type Lang } from "../i18n/strings";
import { Chevron,EmptyState,IconButton,LineButton,SectionHead,UnderlineTabs,Wordmark } from "../theme/mono";
import { actionText,diary,mono,space,textRole } from "../theme/tokens";
import { PressScale } from "../components/Motion";

/** 서재: 지금 읽는 수첩 한 권을 크게, 나머지는 지난 호처럼 꽂아 둔다. */
export function LibraryScreen({
  library,
  saving,
  now,
  onCreate,
  onOpen,
  onSettings,
  accountLabel,
  onSignIn,
}: {
  library: TripLibrary;
  saving: boolean;
  now: Date;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
  /** 아래 줄에 보일 계정 상태. 없으면 줄을 숨긴다. 백업이 잘 되는 중이면 알릴 것이 없다. */
  accountLabel?: string;
  /** 로그인하지 않고 맛보기 중이면 로그인 화면으로 가는 함수. 있으면 아래 줄 대신 맛보기 띠를 보인다. */
  onSignIn?: () => void;
}) {
  const { t, lang } = useI18n();
  const [view, setView] = useState<"all" | "archived">("all");
  const [query, setQuery] = useState<string | null>(null);
  const featured = selectFeaturedTrip(library.trips, now);
  const active = library.trips;
  const q = query?.trim().toLowerCase() ?? "";
  const books = (view === "all" ? active : library.trips.filter((b) => b.settings.archived || notebookDay(b.settings, now).phase === "after")).filter(
    (b) =>
      (view !== "all" || !!q || b.id !== featured?.id) &&
      (!q || b.settings.title.toLowerCase().includes(q) || (b.settings.destination ?? "").toLowerCase().includes(q)),
  );
  const canCreate = !saving && library.trips.length < 50;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.gutter, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderColor: diary.edge }}>
        <IconButton finish="silver" icon="gear" label={t("library.settings")} onPress={onSettings} disabled={saving} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Wordmark size={24} />

        </View>
        <IconButton finish="silver" icon="search" label={t("library.search")} onPress={() => setQuery(query === null ? "" : null)} />
        <IconButton finish="silver" icon="plus" label={t("library.new")} disabled={!canCreate} onPress={onCreate} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 36, gap: 18 }}>
        {query !== null && (
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t("library.searchHint")}
            placeholderTextColor={mono.gray}
            accessibilityLabel={t("library.search")}
            style={[textRole.body, { borderWidth: 1, borderColor: diary.silver, borderRadius: 0, backgroundColor: "transparent", paddingHorizontal: 14, paddingVertical: 12, color: mono.ink }]}
          />
        )}
        <Text accessibilityRole="header" style={[textRole.pageTitle,{color:mono.ink}]}>{t("library.heading")}</Text>
        <UnderlineTabs items={[{ key: "all", title: t("library.all"), count: active.length }, { key: "archived", title: t("library.past") }]} value={view} onChange={setView} style={{ marginTop: -18 }} />

        {!library.trips.length && view === "all" && !q && (
          <View style={{ gap: 14 }}>
            <LineButton title={t("library.first")} onPress={onCreate} disabled={!canCreate} icon="plus" style={{ borderRadius: 0, borderColor: diary.silver, backgroundColor: "transparent" }} />
            <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { textAlign: "center", color: mono.gray }]}>{t("library.firstHint")}</Text>
          </View>
        )}

        {featured && view === "all" && !q && (() => {
          return (
            <View style={{ gap: 14 }}>
              <PressScale
                label={`${featured.settings.title}, ${status(featured, now, lang).text}`}
                disabled={saving}
                onPress={() => onOpen(featured.id)}
                style={{ borderRadius: diary.radius }}
              >
              <TripPreview trip={featured} />
              </PressScale>
            </View>
          );
        })()}

        {!!books.length && !q && (
          <SectionHead title={t(view === "archived" ? "library.finished" : "library.others")} right={<Text style={[textRole.meta, { color: mono.gray }]}>{t("library.newCount", { n: books.length })}</Text>} />
        )}
        <View style={{ marginTop:-8 }}>
          {books.map((book) => (
            <PressScale
              key={book.id}
              disabled={saving}
              label={`${book.settings.title}, ${status(book, now, lang).text}`}
              onPress={() => onOpen(book.id)}
            >
            <TripPreview trip={book} compact />
            </PressScale>
          ))}
        </View>
        {!books.length && (view === "archived" || !!q) && (
          <EmptyState text={q ? t("library.noMatch") : t("library.noPast")} />
        )}

      </ScrollView>
      {onSignIn ? (
        // 맛보기: 수첩이 이 기기에만 있고 백업되지 않는다는 것을 늘 보이게 하고 로그인으로 이끈다.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("library.trialTitle")}. ${t("library.trialBody")}`}
          accessibilityHint={t("library.trialSignIn")}
          disabled={saving}
          onPress={onSignIn}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: space.gutter, paddingVertical: 10, borderTopWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
        >
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { flex: 1, color: mono.gray }]}>
            <Text style={{ fontWeight: "600", color: mono.ink }}>{t("library.trialTitle")}</Text>
            {`  ${t("library.trialBody")}`}
          </Text>
          <Text style={actionText.inline}>{t("library.trialSignIn")}</Text>
        </Pressable>
      ) : accountLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accountLabel}
          disabled={saving}
          onPress={onSettings}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: space.gutter, borderTopWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[textRole.meta, { flex: 1, color: mono.gray }]}>{accountLabel}</Text>
          <Chevron />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 표지 아래 한 줄: 여행 중이면 "여행 중", 아니면 기간. */
function status(book: TripWorkspace, now: Date, lang: Lang) {
  if (notebookDay(book.settings, now).phase === "during") return { traveling: true, text: translate(lang, "library.traveling") };
  return { traveling: false, text: formatDateRange(lang, book.settings.startDate, book.settings.endDate) };
}
