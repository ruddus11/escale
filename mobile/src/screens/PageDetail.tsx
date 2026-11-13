import { File } from "expo-file-system";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import type { PageEntry } from "../data/model";
import { useI18n } from "../i18n/I18n";
import { formatDay } from "../i18n/strings";
import { Caps, Icon, LineButton, SolidButton, TextLink } from "../theme/mono";
import { JournalPaper, journalType } from "../components/JournalPaper";
import { journalHeading } from "../data/journal";
import { isTripSummaryPage, summaryPageContent } from "../data/tripSummary";
import { stickerPhotoUri } from "../data/photoStickerStore";
import type { PaperStyle } from "../data/notebookDesign";
import { mono, space, stroke, textRole } from "../theme/tokens";
import { openLink } from "./Reservations";
import { isPickedLine } from "../data/pickedLine";
import { GoogleMapsAttribution } from "../legal/GoogleMapsAttribution";

// 계획·가고 싶은 곳·기록 한 장을 펼쳐 읽는 화면.
export function PageDetail({ item, paper = "plain", saving, onEdit, onToggleDone, onDelete }: { item: PageEntry; paper?: PaperStyle; saving: boolean; onEdit: () => void; onToggleDone: () => void; onDelete: () => void }) {
  const { t, title, lang } = useI18n();
  // 맞춤 추천으로 담은 장소는 본문에 구글맵 주소가 한 줄 들어 있다.
  const lines = item.body.split("\n");
  const mapUrl = item.kind === "journal" ? "" : lines.find((l) => l.startsWith("https://")) ?? (item.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}` : "");
  const body = lines.filter((l) => !l.startsWith("https://")).join("\n").trim();
  // 추천으로 담은 장소의 이름·주소는 Google이 준 것이라 출처를 붙인다.
  const fromGoogle = item.kind === "place" && isPickedLine(lines[0]);
  const kind = title(item.kind === "plan" ? "plan" : item.kind === "place" ? "wishlist" : "stories");
  const heading = item.kind === "journal" ? journalHeading(item) : item.title;
  const summary = isTripSummaryPage(item);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 14, paddingBottom: 48, gap: 20 }}>
      <Caps color={mono.ink}>{[kind, formatDay(lang, item.date), item.time].filter(Boolean).join(" · ")}</Caps>
      {!!heading && <Text selectable style={journalType.heading}>{heading}</Text>}
      {(!!item.address || !!mapUrl) && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: mono.hair }}>
          <Icon name="pin" />
          <Text selectable style={[textRole.meta, { flex: 1, color: mono.ink }]}>
            {item.address}
          </Text>
          {!!mapUrl && (
            <Pressable
              accessibilityRole="link"
              onPress={() => void openLink(mapUrl)}
              hitSlop={8}
              style={({ pressed }) => ({ minHeight:44,paddingHorizontal:12, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: stroke.button, borderColor: mono.ink, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[textRole.control, { color: mono.ink }]}>{t("page.map")}</Text>
              <Icon name="chevron" size={16} />
            </Pressable>
          )}
        </View>
      )}
      {fromGoogle && (
        <View style={{ alignItems: "flex-end", marginTop: -12 }}>
          <GoogleMapsAttribution />
        </View>
      )}
      {(item.kind === "journal" ? item.body.trim() : body) ? (
        item.kind === "journal" ? summary ? <TripSummaryDisplay body={item.body} paper={paper} /> : <JournalPaper paper={paper}>
            <Text selectable style={journalType.body}>{item.body.trim()}</Text>
        </JournalPaper> : <Text selectable style={[textRole.body,{color:mono.ink}]}>{body}</Text>
      ) : (
        <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("page.noNote")}</Text>
      )}
      {item.kind !== "journal" &&
        (item.done ? (
          <LineButton title={t("page.undone")} disabled={saving} onPress={onToggleDone} />
        ) : (
          <SolidButton title={t("page.done")} disabled={saving} onPress={onToggleDone} />
        ))}
      {item.kind !== "journal" && <LineButton title={t("common.edit")} icon="pen" disabled={saving} onPress={onEdit} />}
      <TextLink
        tone="danger"
        title={t("common.delete")}
        disabled={saving}
        style={{ alignSelf: "center" }}
        onPress={() =>
          Alert.alert(t("page.deleteTitle"), t("page.deleteBody"), [
            { text: t("common.keep"), style: "cancel" },
            { text: t("common.delete"), style: "destructive", onPress: onDelete },
          ])
        }
      />
    </ScrollView>
  );
}

/** 저장된 사진 스티커 파일만 읽는다. 사진이 삭제됐으면 글 요약은 계속 보인다. */
export function TripSummaryDisplay({ body, paper }: { body: string; paper: PaperStyle }) {
  const { t } = useI18n();
  const { text, photos } = summaryPageContent(body);
  return <JournalPaper paper={paper}>
    <Text selectable style={journalType.body}>{text}</Text>
    {!!photos.length && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
      {photos.map((file, index) => {
        const uri = stickerPhotoUri(file);
        return uri && new File(uri).exists ? <Image key={file} source={{ uri }} accessibilityLabel={`${t("summary.photos")} ${index + 1}`} style={{ width: 96, height: 96, borderWidth: stroke.button, borderColor: mono.hair }} /> : null;
      })}
    </View>}
  </JournalPaper>;
}
