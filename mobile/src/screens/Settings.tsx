import { useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Modal, Alert, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import appConfig from "../../app.json";
import type { useAccount } from "../data/useAccount";
import { useI18n } from "../i18n/I18n";
import { LANGS } from "../i18n/strings";
import { Check, Chevron, Icon, IconButton, TextLink, TopBar } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";
import { AccountSection } from "./Account";
import { AI_FEATURES, OPERATOR, PUBLIC_LEGAL_URLS, aiDocId, legalDate, operatorText, type PublicLegalPage } from "../../../src/domain/legal";
import { legalLang, type ConsentRecord } from "../data/consent";
import { paidBuild } from "../data/premium";
import { AI_FEATURE_NAME, useLegal, useLegalDocuments } from "../legal/Legal";

const version = appConfig.expo.version;

/** 앱 전체 설정. 서재 왼쪽 위 톱니바퀴로 들어온다. 실제로 동작하는 항목만 둔다. */
export function SettingsScreen({
  account,
  saving,
  busy,
  canExport,
  onBack,
  onExport,
  onImport,
}: {
  account: ReturnType<typeof useAccount>;
  saving: boolean;
  busy: boolean;
  canExport: boolean;
  onBack: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const { t, lang, setLang, titlesInEnglish, setTitlesInEnglish } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const legal = useLegal();
  const docs = useLegalDocuments();
  const contact = operatorText(legalLang(lang)).email;
  const agreed = (record: ConsentRecord | undefined) => (record ? t("legal.agreedOn", { date: legalDate(legalLang(lang), localDay(record.at)) }) : t("legal.notAgreed"));
  const selectedLanguage = LANGS.find(item => item.code === lang)!;
  const heading = t("settings.label");
  const openPublic = (page: PublicLegalPage) => {
    const url = `${PUBLIC_LEGAL_URLS[page]}?lang=${legalLang(lang)}`;
    Linking.openURL(url).catch(() => Alert.alert(t("legal.openFailed"), url));
  };
  return (
    <View style={{ flex: 1, backgroundColor: mono.bg }}>
      <TopBar
        left={<IconButton icon="back" label={t("common.toLibrary")} onPress={onBack} disabled={saving} />}
        center={<Text accessibilityRole="header" style={[textRole.itemTitle, { color: mono.ink }]}>{heading}</Text>}
      />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 16, paddingBottom: 40, gap: 24 }}>
        <AccountSection account={account} bare />

        {/* 카드나 종이 음영 없이 위아래 선으로만 묶는다. 짧은 묶음의 접힘 음영은 회색 띠처럼 보인다. */}
        <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: mono.hair }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("settings.language")}, ${selectedLanguage.native}`}
            accessibilityState={{ expanded: languageOpen }}
            onPress={() => setLanguageOpen(true)}
            style={({ pressed }) => ({ minHeight: 58, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: lang.startsWith("en-") ? 0 : 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[textRole.body, { flex: 1, color: mono.ink }]}>{t("settings.language")}</Text>
            <Text style={[textRole.meta, { color: mono.gray, flexShrink: 1 }]}>{selectedLanguage.native}</Text>
            <Chevron />
          </Pressable>
          {!lang.startsWith("en-") && <Toggle title={t("settings.titles")} value={titlesInEnglish} onChange={setTitlesInEnglish} />}
        </View>

        <View style={{ gap: 12 }}>
          <SubHead title={t("settings.backup")} />

          <LinkRow
            title={t("settings.export")}
            disabled={!canExport || busy || saving}
            onPress={() =>
              Alert.alert(t("settings.exportTitle"), t("settings.exportBody"), [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("settings.makeFile"), onPress: onExport },
              ])
            }
          />
          <LinkRow title={t("settings.import")} disabled={busy || saving} onPress={onImport} />
        </View>

        <View style={{ gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: legalOpen }} onPress={() => setLegalOpen(!legalOpen)} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[textRole.body, { color: mono.ink }]}>{t("legal.settings")}</Text>
            {legalOpen ? <Icon name="up" size={16} color={mono.gray} /> : <Chevron />}
          </Pressable>
          {legalOpen && <>
          <View>
            <LinkRow title={t("legal.terms")} onPress={() => docs.open("terms")} />
            <LinkRow title={t("legal.privacy")} onPress={() => docs.open("privacy")} />
            <LinkRow title={t("legal.licenses")} onPress={() => docs.open("licenses")} />
            {/* 스토어에 등록한 공개 주소와 같은 문서. 앱 없이도 삭제를 요청하는 방법이 여기에 있다. */}
            <LinkRow title={t("legal.webPages")} onPress={() => openPublic("privacy")} />
            <LinkRow title={t("legal.webTerms")} onPress={() => openPublic("terms")} />
            <LinkRow title={t("legal.deletionPage")} onPress={() => openPublic("accountDeletion")} />
          </View>
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("settings.privacyNote")}</Text>

          <SubHead title={t("legal.consents")} />
          <InfoRow title={t("legal.accountConsent")} value={agreed(legal.state.account)} />
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("legal.accountWithdraw")}</Text>
          {(paidBuild.paid || AI_FEATURES.some(legal.featureValid)) && (
            <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("legal.aiPerFeature")}</Text>
          )}
          {AI_FEATURES.map((feature) => {
            const valid = legal.featureValid(feature);
            if (!paidBuild.paid && !valid) return null;
            const name = t(AI_FEATURE_NAME[feature]);
            return (
              <InfoRow
                key={feature}
                title={name}
                value={agreed(valid ? legal.state.features?.[feature] : undefined)}
                view={{ title: t("legal.view"), onPress: () => docs.open(aiDocId(feature)) }}
                action={
                  valid
                    ? {
                        title: t("legal.withdraw"),
                        onPress: () =>
                          Alert.alert(t("legal.withdrawTitle", { name }), t("legal.withdrawBody"), [
                            { text: t("common.cancel"), style: "cancel" },
                            { text: t("legal.withdraw"), style: "destructive", onPress: () => legal.withdrawFeature(feature) },
                          ]),
                      }
                    : undefined
                }
              />
            );
          })}

          <SubHead title={t("legal.permissions")} />
          <Text style={[textRole.meta, { color: mono.ink }]}>{t("legal.camera")}</Text>
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("legal.noOtherPermissions")}</Text>

          <SubHead title={t("legal.contact")} />
          {OPERATOR.email ? (
            <TextLink
              role="link"
              title={contact}
              label={`${t("legal.contact")}, ${contact}`}
              onPress={() => Linking.openURL(`mailto:${OPERATOR.email}`).catch(() => Alert.alert(t("legal.mailFailed"), OPERATOR.email))}
              style={{ alignSelf: "flex-start" }}
            />
          ) : (
            <Text style={[textRole.body, { minHeight: 44, textAlignVertical: "center", color: mono.ink }]}>{contact}</Text>
          )}
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("legal.contactBody")}</Text>
          </>}
        </View>

        <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: mono.hair }}>
          <Text style={[textRole.body, { color: mono.ink }]}>{t("settings.version")}</Text>
          <Text style={[textRole.meta, { color: mono.gray }]}>{version}</Text>
        </View>
      </ScrollView>
      {docs.sheet}
      <Modal visible={languageOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLanguageOpen(false)}>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, paddingTop: 10, backgroundColor: mono.bg }}>
            <TopBar
              left={<IconButton icon="close" label={t("common.close")} onPress={() => setLanguageOpen(false)} />}
              center={<Text accessibilityRole="header" style={[textRole.itemTitle, { color: mono.ink }]}>{t("settings.language")}</Text>}
            />
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: 32 }}>
              <View accessibilityRole="radiogroup" accessibilityLabel={t("settings.language")}>
                {LANGS.map(item => (
                  <Pressable key={item.code} accessibilityRole="radio" accessibilityLabel={item.native}
                    accessibilityState={{ checked: lang === item.code }}
                    onPress={() => { setLang(item.code); setLanguageOpen(false); }}
                    style={({ pressed }) => ({ minHeight: 64, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}>
                    <Text style={[textRole.body, { flex: 1, color: mono.ink, fontWeight: lang === item.code ? "600" : "400" }]}>{item.native}</Text>
                    {lang === item.code && <Check done size={22} />}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

function Toggle({ title, value, onChange }: { title: string; value: boolean; onChange: (on: boolean) => void }) {
  return (
    <View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={[textRole.body, { flex: 1, color: mono.ink }]}>{title}</Text>
      {/* iOS Switch는 자체 스타일 앞에 alignSelf: flex-start를 넣어 부모의 가운데 정렬을 무시한다. */}
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} trackColor={{ false: mono.track, true: mono.ink }} style={{ alignSelf: "center" }} />
    </View>
  );
}

/** 동의 시각(UTC)을 이 기기 날짜 "YYYY-MM-DD"로. */
function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SubHead({ title }: { title: string }) {
  return <Text accessibilityRole="header" style={[textRole.itemTitle, { color: mono.ink }]}>{title}</Text>;
}

function LinkRow({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: mono.hair, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Text style={[textRole.body, { flex: 1, color: mono.ink }]}>{title}</Text>
      <Chevron />
    </Pressable>
  );
}

function InfoRow({
  title,
  value,
  view,
  action,
}: {
  title: string;
  value: string;
  /** 동의서 전문 보기처럼 읽기만 하는 링크. */
  view?: { title: string; onPress: () => void };
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: mono.hair }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[textRole.itemTitle, { color: mono.ink }]}>{title}</Text>
        <Text style={[textRole.meta, { color: mono.gray }]}>{value}</Text>
      </View>
      {view && (
        <TextLink tone="dismiss" title={view.title} label={`${title}, ${view.title}`} onPress={view.onPress} style={{ minWidth: 44 }} />
      )}
      {action && (
        <TextLink tone="danger" title={action.title} label={`${title}, ${action.title}`} onPress={action.onPress} style={{ minWidth: 44 }} />
      )}
    </View>
  );
}
