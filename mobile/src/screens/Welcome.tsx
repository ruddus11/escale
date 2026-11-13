import { ImageBackground, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LoginButtons } from "./Account";
import { useLegalDocuments } from "../legal/Legal";
import { useI18n } from "../i18n/I18n";
import { brandSubtitle, Seal, TextLink, Wordmark } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";

const sea = require("../../assets/welcome-sea.jpg");

/** 앱을 처음 열었을 때의 로그인 화면. 로그인하지 않고도 수첩은 쓸 수 있다(App Store 기준 5.1.1). */
export function WelcomeScreen({ onSkip }: { onSkip: () => void }) {
  const { t, lang } = useI18n();
  const subtitle = brandSubtitle(lang);
  const insets = useSafeAreaInsets();
  const docs = useLegalDocuments();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: mono.bg }}>
      <StatusBar style="light" />
      <ImageBackground source={sea} resizeMode="cover" accessible={false} style={{ flex: 1, paddingTop: insets.top + 6, paddingHorizontal: space.gutter, overflow: "hidden" }}>
        {/* 새 로고처럼 2도 인쇄한 바다 사진 위에 흰 돛을 크게, 이름은 그 아래 작게 둔다. */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Seal size={132} color={mono.white} />
          <Wordmark size={40} color={mono.white} />
          {subtitle && <Text allowFontScaling={false} style={[textRole.meta, { color: mono.white }]}>{subtitle}</Text>}
        </View>
      </ImageBackground>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: 22, paddingBottom: 8, gap: 12, backgroundColor: mono.bg }}>
        <Text style={[textRole.pageTitle, { textAlign: "center", color: mono.ink, marginBottom: 6 }]}>{t("welcome.headline")}</Text>
        <LoginButtons />
        <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray, textAlign: "center" }]}>{t("welcome.note")}</Text>
        <TextLink title={t("welcome.skip")} onPress={onSkip} style={{ alignSelf: "center" }} />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
          {(["terms", "privacy"] as const).map((doc) => (
            <TextLink key={doc} tone="dismiss" title={t(doc === "terms" ? "legal.terms" : "legal.privacy")} onPress={() => docs.open(doc)} />
          ))}
        </View>
      </View>
      {docs.sheet}
    </KeyboardAvoidingView>
  );
}
