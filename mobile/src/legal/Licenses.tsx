import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { canReadNativeNotices, googleMapsNotices } from "../../modules/app-notices";
import { useI18n } from "../i18n/I18n";
import { Chevron, Icon, TextLink } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";
import data from "./licenses.json";

// 앱에 들어간 오픈소스의 이름·판·라이선스와 고지문. scripts/collect-licenses.mjs가 만든다.
interface Package {
  name: string;
  version: string;
  license: string;
  /** texts의 번호. 같은 고지문은 한 번만 담는다. */
  text: number;
}
const packages = data.packages as Package[];
const texts = data.texts as string[];
// 고지문 원문은 줄 맞춤이 있어 고정폭 글꼴로 보인다. 크기는 본문(body)과 같게 둔다.
const licenseFont = { fontFamily: "Menlo" } as const;

export function Licenses() {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const [google, setGoogle] = useState(false);
  if (google) return <GoogleNotices onBack={() => setGoogle(false)} />;
  return (
    <FlatList
      data={packages}
      keyExtractor={(item) => `${item.name}@${item.version}`}
      contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 48 }}
      ListHeaderComponent={
        <View>
          <Text accessibilityRole="header" style={[textRole.pageTitle, { color: mono.ink, marginBottom: 12 }]}>
            {t("legal.licenses")}
          </Text>
          {canReadNativeNotices && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("legal.googleNotices")}
              onPress={() => setGoogle(true)}
              style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[textRole.itemTitle, { color: mono.ink }]}>Google Maps SDK for iOS</Text>
                <Text style={[textRole.body, { color: mono.gray }]}>{t("legal.googleNotices")}</Text>
              </View>
              <Chevron />
            </Pressable>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const key = `${item.name}@${item.version}`;
        const expanded = open === key;
        return (
          <View style={{ borderBottomWidth: 1, borderColor: mono.hair }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${item.name} ${item.version}, ${item.license}`}
              onPress={() => setOpen(expanded ? null : key)}
              style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[textRole.itemTitle, { color: mono.ink }]}>{item.name}</Text>
                <Text style={[textRole.body, { color: mono.gray }]}>{`${item.version} · ${item.license}`}</Text>
              </View>
              <Icon name={expanded ? "up" : "down"} size={16} />
            </Pressable>
            {expanded && (
              <Text selectable style={[textRole.body, licenseFont, { paddingBottom: 14, color: mono.ink }]}>
                {texts[item.text]}
              </Text>
            )}
          </View>
        );
      }}
    />
  );
}

// Google 지도 SDK가 함께 넣어 둔 오픈소스 고지문(약 1MB). 한 덩어리로 그리면 느려서 문단 묶음으로 나눠 목록으로 보인다.
function GoogleNotices({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [chunks, setChunks] = useState<string[] | null>(null);
  useEffect(() => {
    googleMapsNotices().then(
      (text) => setChunks(text ? splitNotices(text) : []),
      () => setChunks([]),
    );
  }, []);
  return (
    <FlatList
      data={chunks ?? []}
      keyExtractor={(_, i) => String(i)}
      initialNumToRender={4}
      contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 48 }}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 12 }}>
          <TextLink body title={t("legal.backToList")} onPress={onBack} style={{ alignSelf: "flex-start" }} />
          <Text accessibilityRole="header" style={[textRole.sectionTitle, { color: mono.ink }]}>Google Maps SDK for iOS</Text>
          {chunks === null && <ActivityIndicator color={mono.ink} />}
          {chunks?.length === 0 && <Text style={[textRole.body, { color: mono.gray }]}>{t("legal.noNotices")}</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <Text selectable style={[textRole.body, licenseFont, { color: mono.ink }]}>
          {item}
        </Text>
      )}
    />
  );
}

/** 빈 줄 기준으로 대략 4천 자씩 묶는다. */
function splitNotices(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const part of text.split(/\n{2,}/)) {
    if (current && current.length + part.length > 4000) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${part}` : part;
  }
  if (current) chunks.push(current);
  return chunks;
}
