import { authProviderColors, mono, textRole } from "../theme/tokens";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { AuthCanceled, AuthError, deleteAccount, loginMethods, sendEmailCode, signIn, verifyEmailCode, type LoginProvider } from "../data/auth";
import type { useAccount } from "../data/useAccount";
import { paidBuild } from "../data/premium";
import { Button, Caption, Field, Label, colors } from "../components/ui";
import { TextLink } from "../theme/mono";
import { useI18n } from "../i18n/I18n";
import { useAccountConsent } from "../legal/Legal";
import type { Key } from "../i18n/strings";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

const statusKey: Record<ReturnType<typeof useAccount>["status"], Key | undefined> = {
  off: undefined,
  syncing: "account.syncing",
  synced: "account.synced",
  offline: "account.offline",
  conflict: "account.conflict",
  error: "account.error",
};

/** 백업 화면 맨 위의 계정 영역. 로그인하면 수첩이 계정에 자동 백업된다. */
/** bare면 맨 위 "계정" 머리말을 빼고 그린다(설정 화면처럼 바깥에 머리말이 있을 때). */
export function AccountSection({ account, bare }: { account: ReturnType<typeof useAccount>; bare?: boolean }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"out" | "delete" | null>(null);
  const [message, setMessage] = useState("");

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    setBusy(kind);
    setMessage("");
    try {
      await action();
    } catch (e) {
      if (!(e instanceof AuthCanceled)) setMessage(e instanceof AuthError ? t(e.key) : t("common.tryLater"));
    } finally {
      setBusy(null);
    }
  }

  if (!account.enabled)
    return (
      <View style={{ gap: 6 }}>
        {!bare && <Label>{t("settings.account")}</Label>}
        <Caption>{t("account.off")}</Caption>
      </View>
    );
  if (!account.ready) return <ActivityIndicator color={mono.ink} />;

  if (!account.session)
    return (
      <View style={{ gap: 10 }}>
        {!bare && <Label>{t("settings.account")}</Label>}
        <Text style={[textRole.sectionTitle, { color: colors.ink }]}>{t("account.pitch")}</Text>
        <Caption>{t("account.pitchBody")}</Caption>
        <LoginButtons />
        <Caption>{t("account.privacy")}</Caption>
      </View>
    );

  const provider = account.provider === "kakao" ? t("login.kakaoName") : account.provider === "apple" ? "Apple" : account.provider === "google" ? "Google" : account.provider ?? "";
  const status = statusKey[account.status];
  return (
    <View style={{ gap: 10 }}>
      {!bare && <Label>{t("settings.account")}</Label>}
      {/* 계정 묶음도 위아래 선으로만 나눈다. 글자의 왼쪽 끝은 화면 거터 하나에 맞춘다. */}
      <View style={{ paddingVertical: 16, gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: mono.hair }}>
        <Text style={[textRole.itemTitle, { color: colors.ink }]}>{account.email ?? t("account.providerAccount", { provider })}</Text>
        <Text style={[textRole.meta, { color: colors.muted }]}>
          {[provider && t("account.via", { provider }), paidBuild.paid && t(account.premium ? "account.paid" : "account.free")].filter(Boolean).join(" · ")}
        </Text>
        <View style={{ gap: 8, marginTop: 4, borderTopWidth: 1, borderColor: mono.hair, paddingTop: 14 }}>
          {account.status === "syncing" && <ActivityIndicator size="small" color={mono.ink} />}
          <Text style={[textRole.meta, { flex: 1, color: account.status === "error" || account.status === "conflict" ? colors.coral : colors.ink }]}>
            {status ? t(status) : ""}
            {account.status === "synced" && account.syncedAt && ` · ${account.syncedAt.getHours()}:${String(account.syncedAt.getMinutes()).padStart(2, "0")}`}
          </Text>
          {account.status !== "syncing" && account.status !== "conflict" && <TextLink title={t("account.backupNow")} onPress={() => void account.sync()} />}
        </View>
      </View>
      {account.conflict && (
        <View style={{ borderWidth: 1.5, borderColor: colors.coral, padding: 16, gap: 8 }}>
          <Text style={[textRole.itemTitle, { color: colors.ink }]}>{t("account.differ")}</Text>
          <Caption>{t("account.differBody")}</Caption>
          {account.conflictChanged && <Text style={[textRole.meta, { fontWeight: "600", color: colors.coral }]}>{t("account.changedRetry")}</Text>}
          {/* 아무것도 잃지 않는 선택을 맨 위에 둔다. 확인 창 없이 바로 합친다. */}
          <Button title={t("account.keepBoth")} disabled={account.status === "syncing"} onPress={() => void account.resolveConflict("both")} />
          <Caption>{t("account.keepBothNote")}</Caption>
          <Button quiet title={t("account.useAccount")} disabled={account.status === "syncing"} onPress={() => confirmChoice("account")} />
          <Button quiet title={t("account.useDevice")} disabled={account.status === "syncing"} onPress={() => confirmChoice("device")} />
        </View>
      )}
      {!!message && <Text style={[textRole.meta, { color: colors.coral }]}>{message}</Text>}
      <View style={{ flexDirection: "row", gap: 4 }}>
        <TextLink title={t(busy === "out" ? "account.signingOut" : "account.signOut")} disabled={!!busy} onPress={confirmSignOut} />
        <View style={{ flex: 1 }} />
        <TextLink tone="danger" title={t(busy === "delete" ? "account.deleting" : "account.delete")} disabled={!!busy} onPress={confirmDelete} />
      </View>
    </View>
  );

  function confirmChoice(keep: "device" | "account") {
    Alert.alert(
      t(keep === "account" ? "account.loadTitle" : "account.overwriteTitle"),
      t(keep === "account" ? "account.loadBody" : "account.overwriteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t(keep === "account" ? "account.load" : "account.overwrite"), style: "destructive", onPress: () => void account.resolveConflict(keep) },
      ],
    );
  }

  // 로그아웃하면 이 기기의 수첩을 지운다. 계정에 다 올라간 것을 확인한 뒤에만 바로 지우고,
  // 못 올렸으면(오프라인·충돌) 한 번 더 묻는다.
  function confirmSignOut() {
    Alert.alert(t("account.signOutTitle"), t("account.signOutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.signOut"),
        onPress: () =>
          void run("out", async () => {
            if (await account.flush()) return account.signOutAndClear();
            Alert.alert(t("account.unsyncedTitle"), t("account.unsyncedBody"), [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("account.signOutAnyway"), style: "destructive", onPress: () => void run("out", account.signOutAndClear) },
            ]);
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(t("account.deleteTitle"), t("account.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.delete"),
        style: "destructive",
        onPress: () =>
          void run("delete", async () => {
            await deleteAccount(API_BASE_URL, account.session!.access_token);
            await account.forget({ releaseOwner: true });
          }),
      },
    ]);
  }
}

// 외부 로그인 버튼. 색·모서리·테두리는 제공자(Apple·Kakao·Google) 버튼 규정을 따르는 예외라 수첩 버튼 규칙을 적용하지 않는다.
function ProviderButton({ title, background, color, border, busy, disabled, onPress }: { title: string; background: string; color: string; border?: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: background,
        borderWidth: border ? 1.5 : 0,
        borderColor: border,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled && !busy ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={color} /> : <Text style={[textRole.control, { color }]}>{title}</Text>}
    </Pressable>
  );
}

/** 로그인 버튼 묶음. 첫 화면과 계정 화면에서 같이 쓴다. 설정을 마친 방법만 보인다. */
/** 어떤 방법이든 로그인(가입) 전에 필수 동의를 먼저 받는다(개인정보 보호법 제15·22조의2·28조의8). */
export function LoginButtons() {
  const { t } = useI18n();
  const consent = useAccountConsent();
  const [busy, setBusy] = useState<LoginProvider | null>(null);
  const [message, setMessage] = useState("");
  async function start(provider: LoginProvider) {
    if (busy) return;
    if (!(await consent.ask())) return;
    setBusy(provider);
    setMessage("");
    try {
      await signIn(provider);
    } catch (e) {
      if (!(e instanceof AuthCanceled)) setMessage(e instanceof AuthError ? t(e.key) : t("common.tryLater"));
    } finally {
      setBusy(null);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      {loginMethods.includes("apple") &&
        (Platform.OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={{ height: 52, opacity: busy ? 0.4 : 1 }}
            onPress={() => void start("apple")}
          />
        ) : (
      <ProviderButton title={t("login.apple")} background={authProviderColors.apple.background} color={authProviderColors.apple.foreground} busy={busy === "apple"} disabled={!!busy} onPress={() => void start("apple")} />
        ))}
      {loginMethods.includes("kakao") && <ProviderButton title={t("login.kakao")} background={authProviderColors.kakao.background} color={authProviderColors.kakao.foreground} busy={busy === "kakao"} disabled={!!busy} onPress={() => void start("kakao")} />}
      {loginMethods.includes("google") && <ProviderButton title={t("login.google")} background={authProviderColors.google.background} color={authProviderColors.google.foreground} border={authProviderColors.google.border} busy={busy === "google"} disabled={!!busy} onPress={() => void start("google")} />}
      {loginMethods.includes("email") && <EmailLogin disabled={!!busy} askConsent={consent.ask} />}
      {!!message && <Text accessibilityRole="alert" style={[textRole.meta, { color: colors.coral }]}>{message}</Text>}
      {consent.sheet}
    </View>
  );
}

// 이메일 → 코드 두 단계. 코드를 확인하면 세션이 생기고 화면은 로그인 상태로 바뀐다.
function EmailLogin({ disabled, askConsent }: { disabled: boolean; askConsent: () => Promise<boolean> }) {
  const { t } = useI18n();
  const [step, setStep] = useState<"closed" | "email" | "code">("closed");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof AuthError ? t(e.key) : t("common.tryLater"));
    } finally {
      setBusy(false);
    }
  }
  const send = () =>
    run(async () => {
      setSentTo(await sendEmailCode(email));
      setCode("");
      setStep("code");
    });

  if (step === "closed")
    return (
      <ProviderButton
        title={t("login.email")}
        background="transparent"
        color={colors.ink}
        border={colors.ink}
        busy={false}
        disabled={disabled}
        onPress={() => void askConsent().then((ok) => ok && setStep("email"))}
      />
    );

  return (
    <View style={{ borderWidth: 1.5, borderColor: colors.ink, padding: 16, gap: 10 }}>
      {step === "email" ? (
        <>
          <Field label={t("login.emailLabel")} value={email} onChangeText={setEmail} autoFocus autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" returnKeyType="send" onSubmitEditing={() => !busy && void send()} />
          <Button title={t(busy ? "login.sending" : "login.getCode")} disabled={busy || !email.trim()} onPress={() => void send()} />
        </>
      ) : (
        <>
          <Text style={[textRole.meta, { color: colors.ink }]}>{t("login.sent", { email: sentTo })}</Text>
          <Field label={t("login.code")} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 10))} autoFocus keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={10} />
          <Button title={t(busy ? "login.checking" : "login.signIn")} disabled={busy || code.length < 6} onPress={() => void run(() => verifyEmailCode(sentTo, code))} />
          <View style={{ flexDirection: "row" }}>
            <TextLink title={t("login.otherEmail")} disabled={busy} onPress={() => setStep("email")} />
            <View style={{ flex: 1 }} />
            <TextLink title={t("login.resend")} disabled={busy} onPress={() => void send()} />
          </View>
        </>
      )}
      {!!message && <Text accessibilityRole="alert" style={[textRole.meta, { color: colors.coral }]}>{message}</Text>}
    </View>
  );
}
