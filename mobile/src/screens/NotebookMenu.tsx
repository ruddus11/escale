import { Modal, Pressable, ScrollView, Text } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../i18n/I18n";
import { IconButton, TopBar } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";

export type NotebookMenuAction = "settings" | "archive" | "delete";

// 기본 Alert는 Android에서 세 버튼까지만 표시하므로 여행 메뉴를 시트 한 장에 둔다.
export function NotebookMenu({ open, title, archived, onBack, onSelect, onDismiss }: {
  open: boolean;
  title: string;
  archived: boolean;
  onBack: () => void;
  onSelect: (action: NotebookMenuAction) => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const rows: { key: NotebookMenuAction; label: string }[] = [
    { key: "settings", label: t("app.settings") },
    { key: "archive", label: t(archived ? "app.unarchive" : "app.archive") },
    { key: "delete", label: t("app.deleteNotebook") },
  ];
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onBack} onDismiss={onDismiss}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, paddingTop: 10, backgroundColor: mono.bg }}>
          <TopBar
            left={<IconButton icon="close" label={t("common.close")} onPress={onBack} />}
            center={<Text accessibilityRole="header" style={[textRole.itemTitle, { color: mono.ink }]}>{t("trip.menu")}</Text>}
          />
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 18, paddingBottom: 40 }}>
            <Text style={[textRole.meta, { color: mono.gray, marginBottom: 18 }]}>{title}</Text>
            {rows.map((row) => (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                onPress={() => onSelect(row.key)}
                style={({ pressed }) => ({ minHeight: 56, paddingVertical: 14, justifyContent: "center", borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[textRole.body, { color: row.key === "delete" ? mono.warn : mono.ink }]}>{row.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
