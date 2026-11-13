import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { ExtractedReservation } from "../../../src/domain/reservations/confirmation";
import { hasPremium, paidBuild, premiumCredential, type PremiumSettings } from "../data/premium";
import { filledCount, ImportError, requestExtraction } from "../data/confirmationImport";
import { isLimitKey } from "../data/usageLimit";
import { Caption, Field, TextAction, colors } from "./ui";
import { useI18n } from "../i18n/I18n";
import { useAiConsent } from "../legal/Legal";
import { Icon } from "../theme/mono";
import { diary, mono, textRole } from "../theme/tokens";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

/** 예약 확인 메일·문자를 붙여넣어 예약 칸을 채운다(유료). */
export function PasteImport({
  year,
  premium,
  onPremiumChange,
  onFill,
}: {
  year: number;
  premium: PremiumSettings;
  onPremiumChange: (next: PremiumSettings) => void;
  onFill: (value: ExtractedReservation) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [accessCode, setAccessCode] = useState(premium.accessCode);
  const [state, setState] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [limited, setLimited] = useState(false);
  const aiConsent = useAiConsent("booking");

  async function read() {
    // 메일 내용을 미국의 TypeSafe로 보내기 전에 동의를 받는다.
    if (!(await aiConsent.ask())) return;
    setState("reading");
    setMessage("");
    setLimited(false);
    try {
      const value = await requestExtraction({ baseUrl: API_BASE_URL, accessCode: premiumCredential(premium, accessCode), text, year });
      const count = filledCount(value);
      if (!count) {
        setState("error");
        setMessage(t("paste.nothing"));
        return;
      }
      onFill(value);
      if (!premium.member && accessCode !== premium.accessCode) onPremiumChange({ ...premium, accessCode });
      setState("done");
      setMessage(t("paste.filled", { n: count }));
      setText("");
    } catch (e) {
      setState("error");
      setMessage(e instanceof ImportError ? t(e.key) : t("paste.failed"));
      setLimited(e instanceof ImportError && isLimitKey(e.key));
    }
  }

  return (
    <View style={{ borderWidth: 1.5, borderColor: mono.ink, padding: 16, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("paste.title")} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", minHeight: 32 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[textRole.itemTitle, { color: colors.ink }]}>{t("paste.title")}</Text>
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: colors.muted }]}>{t("paste.hint")}</Text>
        </View>
        <Icon name={open ? "up" : "down"} size={16} />
      </Pressable>
      {open && !hasPremium(premium) && (
        <>
          <Caption>{t("paste.members")}</Caption>
          {paidBuild.testTools && <TextAction title={t("dev.previewOn")} onPress={() => onPremiumChange({ ...premium, preview: true })} />}
        </>
      )}
      {open && hasPremium(premium) && (
        <>
          <TextInput
            value={text}
            onChangeText={(value) => {
              setText(value);
              if (state !== "reading") setState("idle");
            }}
            multiline
            maxLength={6000}
            placeholder={t("paste.placeholder")}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t("paste.content")}
            style={{ minHeight: 110, maxHeight: 220, backgroundColor: diary.surface, borderWidth: 1, borderColor: mono.hair, padding: 12, ...textRole.meta, color: colors.ink, textAlignVertical: "top" }}
          />
          {paidBuild.testTools && !premium.accessCode && !premium.member && <Field label={t("paste.code")} value={accessCode} secureTextEntry autoCapitalize="none" onChangeText={setAccessCode} />}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <TextAction title={t("paste.fromClipboard")} onPress={() => void Clipboard.getStringAsync().then((value) => value && setText(value))} />
            <View style={{ flex: 1 }} />
            <TextAction title={t(state === "reading" ? "paste.reading" : "paste.read")} disabled={!text.trim() || !premiumCredential(premium, accessCode) || state === "reading"} onPress={() => void read()} />
          </View>
          {!!message && <Text style={[textRole.meta, { color: state === "error" && !limited ? colors.coral : colors.ink }]}>{message}</Text>}
          <Caption>{t("paste.privacy")}</Caption>
        </>
      )}
      {aiConsent.sheet}
    </View>
  );
}
