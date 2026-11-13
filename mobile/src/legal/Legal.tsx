import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { aiDocId, legalDocument, type AiFeature, type LegalDocId } from "../../../src/domain/legal";
import {
  ACCOUNT_ITEMS,
  GUEST,
  accountConsentValid,
  agreeAccount,
  agreeFeature,
  featureConsentValid,
  forgetAccount,
  legalLang,
  markSent,
  sendConsents,
  unsentConsents,
  withdrawFeature,
  type AccountItem,
  type ConsentRow,
  type ConsentState,
} from "../data/consent";
import { consentStore } from "../data/sqlite";
import { useI18n } from "../i18n/I18n";
import type { Key } from "../i18n/strings";
import { Check, IconButton, LineButton, SolidButton, TextLink, TopBar } from "../theme/mono";
import { mono, space, stroke, textRole } from "../theme/tokens";
import { LegalText } from "./LegalText";
import { Licenses } from "./Licenses";

type Insert = (rows: ConsentRow[]) => PromiseLike<{ error: { code?: string } | null }>;

/** 설정의 동의 내역에 보이는 기능 이름. */
export const AI_FEATURE_NAME: Record<AiFeature, Key> = {
  recommend: "legal.featureRecommend",
  booking: "legal.featureBooking",
  pouch: "legal.featurePouch",
};

const AI_AGREE: Record<AiFeature, Key> = {
  recommend: "legal.agreeRecommend",
  booking: "legal.agreeBooking",
  pouch: "legal.aiAgree",
};

interface Legal {
  ready: boolean;
  state: ConsentState;
  /** 지금 동의 주인. 로그인했으면 계정 id, 아니면 GUEST. */
  owner: string;
  accountValid: boolean;
  /** 지금 주인이 이 기능의 지금 판 동의서에 동의했는지. */
  featureValid(feature: AiFeature): boolean;
  agreeAccount(items: AccountItem[]): void;
  /** 기능 동의를 기기에 저장한다. 저장하지 못하면 false를 주고 동의하지 않은 상태로 둔다. */
  agreeFeature(feature: AiFeature): Promise<boolean>;
  withdrawFeature(feature: AiFeature): void;
  forgetAccount(): void;
  /** 로그인한 계정이 바뀔 때 부른다. 기능 동의는 그 주인의 것만 효력이 있다. */
  setOwner(owner: string): void;
  /** 로그인한 계정으로 아직 안 올린 동의·철회 기록을 올린다. */
  send(insert: Insert, userId: string): Promise<void>;
}

const LegalContext = createContext<Legal | null>(null);

/** 동의 기록을 들고 있는다. 동의 화면은 쓰는 화면 안에 그린다(모달 위 모달이 iOS에서 안 뜨는 것을 피한다). */
export function LegalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsentState>({});
  const [ready, setReady] = useState(false);
  const [owner, setOwnerState] = useState(GUEST);
  const current = useRef(state);
  const owned = useRef(owner);
  // 저장된 기록을 읽기 전에 바꾸면 그 기록을 덮어쓴다. 모든 변경은 읽기가 끝난 뒤에 한다.
  const loaded = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    loaded.current = consentStore
      .load()
      .then(
        (saved) => {
          current.current = saved;
          setState(saved);
        },
        () => undefined,
      )
      .finally(() => setReady(true));
  }, []);
  const commit = useCallback(async (change: (prev: ConsentState) => ConsentState, undoOnFail = false): Promise<boolean> => {
    await loaded.current;
    const prev = current.current;
    const next = change(prev);
    if (next === prev) return true;
    current.current = next;
    setState(next);
    try {
      await consentStore.save(next);
      return true;
    } catch {
      // 기능 동의를 저장하지 못했으면 없던 일로 되돌려, 기록 없이 보내는 일이 없게 한다.
      if (undoOnFail && current.current === next) {
        current.current = prev;
        setState(prev);
      }
      return false;
    }
  }, []);
  // 함수는 한 번만 만들어 화면의 효과(useEffect)가 동의 상태가 바뀔 때마다 다시 돌지 않게 한다.
  const actions = useMemo(
    () => ({
      agreeAccount: (items: AccountItem[]) => void commit((prev) => agreeAccount(prev, items, new Date())),
      agreeFeature: (feature: AiFeature) => commit((prev) => agreeFeature(prev, feature, owned.current, new Date()), true),
      // 철회는 저장에 실패해도 지금부터 보내지 않도록 그대로 둔다.
      withdrawFeature: (feature: AiFeature) => void commit((prev) => withdrawFeature(prev, feature, new Date())),
      forgetAccount: () => void commit((prev) => (prev.account || prev.features || prev.withdrawals ? forgetAccount(prev) : prev)),
      setOwner: (next: string) => {
        owned.current = next;
        setOwnerState(next);
      },
      send: async (insert: Insert, userId: string) => {
        await loaded.current;
        const rows = await sendConsents(insert, unsentConsents(current.current, userId));
        // 올리는 동안 기록이 바뀌었으면 같은 기록에만 올린 표시를 한다.
        if (rows.length) await commit((prev) => markSent(prev, rows));
      },
    }),
    [commit],
  );
  const value = useMemo<Legal>(
    () => ({
      ready,
      state,
      owner,
      accountValid: accountConsentValid(state),
      featureValid: (feature: AiFeature) => featureConsentValid(state, feature, owner),
      ...actions,
    }),
    [ready, state, owner, actions],
  );
  return <LegalContext.Provider value={value}>{children}</LegalContext.Provider>;
}

export function useLegal() {
  const value = useContext(LegalContext);
  if (!value) throw new Error("useLegal must be used inside LegalProvider");
  return value;
}

// 동의 시트를 열고 답을 기다린다. iOS는 시트가 완전히 닫힌 뒤(onDismiss) 답해야
// 이어서 여는 Apple 로그인 창이나 다음 화면이 뜬다. onDismiss가 오지 않는 경우를 대비해 잠시 뒤에도 답한다.
// 동의 기록을 아직 읽지 못했으면 묻지도 보내지도 않는다.
function useAsk(valid: boolean, ready: boolean) {
  const [open, setOpen] = useState(false);
  const waiting = useRef<((ok: boolean) => void) | null>(null);
  const answer = useRef(false);
  const settle = useCallback(() => {
    const done = waiting.current;
    waiting.current = null;
    done?.(answer.current);
  }, []);
  const close = useCallback(
    (ok: boolean) => {
      answer.current = ok;
      setOpen(false);
      if (Platform.OS === "ios") setTimeout(settle, 900);
      else settle();
    },
    [settle],
  );
  const ask = useCallback(() => {
    if (!ready) return Promise.resolve(false);
    if (valid) return Promise.resolve(true);
    if (waiting.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      waiting.current = resolve;
      answer.current = false;
      setOpen(true);
    });
  }, [valid, ready]);
  return { open, ask, close, settle };
}

/** 로그인 전 필수 동의. ask()가 true를 주면 로그인을 이어간다. sheet는 화면 안에 그린다. */
export function useAccountConsent() {
  const legal = useLegal();
  const { open, ask, close, settle } = useAsk(legal.accountValid, legal.ready);
  const sheet = (
    <ConsentSheet
      visible={open}
      mode="signup"
      onAgree={(items) => {
        legal.agreeAccount(items);
        close(true);
      }}
      onCancel={() => close(false)}
      onDismiss={settle}
    />
  );
  return { ask, sheet };
}

/**
 * AI·장소 기능으로 보내기 전 동의. 기능마다 따로 묻는다. ask()가 true를 줄 때만 보낸다.
 * 동의를 기기에 저장한 뒤에만 true를 주고, 닫거나 저장에 실패하면 false다.
 */
export function useAiConsent(feature: AiFeature) {
  const legal = useLegal();
  const { open, ask, close, settle } = useAsk(legal.featureValid(feature), legal.ready);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const sheet = (
    <AiConsentSheet
      feature={feature}
      visible={open}
      saving={saving}
      failed={failed}
      onAgree={() => {
        if (busy.current) return;
        busy.current = true;
        setSaving(true);
        setFailed(false);
        void legal.agreeFeature(feature).then((ok) => {
          busy.current = false;
          setSaving(false);
          if (ok) close(true);
          else setFailed(true);
        });
      }}
      onCancel={() => {
        // 저장하는 동안에는 닫지 않는다. 닫힌 뒤에 동의가 저장돼 보내지는 일을 막는다.
        if (busy.current) return;
        setFailed(false);
        close(false);
      }}
      onDismiss={settle}
    />
  );
  return { ask, sheet };
}

/** 약관·처리방침·라이선스를 여는 시트. */
export function useLegalDocuments() {
  const [doc, setDoc] = useState<LegalDocId | "licenses" | null>(null);
  const sheet = <DocumentSheet doc={doc} onClose={() => setDoc(null)} />;
  return { open: setDoc, sheet };
}

const ACCOUNT_ROWS: { item: AccountItem; label: Key; doc?: LegalDocId }[] = [
  { item: "age14", label: "legal.age" },
  { item: "terms", label: "legal.terms", doc: "terms" },
  { item: "collection", label: "legal.collection", doc: "collection" },
  { item: "overseas", label: "legal.overseas", doc: "overseas" },
];

/**
 * 계정 동의 시트. signup은 로그인 버튼을 누른 뒤, renew는 로그인한 상태인데 지금 판의 동의 기록이 없을 때 연다.
 * renew는 닫을 수 없고 동의하거나 로그아웃해야 한다.
 */
export function ConsentSheet({
  visible,
  mode,
  onAgree,
  onCancel,
  onDismiss,
}: {
  visible: boolean;
  mode: "signup" | "renew";
  onAgree: (items: AccountItem[]) => void;
  onCancel: () => void;
  onDismiss?: () => void;
}) {
  const { t, lang } = useI18n();
  const [checked, setChecked] = useState<AccountItem[]>([]);
  const [viewing, setViewing] = useState<LegalDocId | null>(null);
  useEffect(() => {
    if (visible) {
      setChecked([]);
      setViewing(null);
    }
  }, [visible]);
  const all = ACCOUNT_ITEMS.every((item) => checked.includes(item));
  const toggle = (item: AccountItem) => setChecked((list) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]));
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={mode === "signup" ? "pageSheet" : "fullScreen"}
      onRequestClose={() => (viewing ? setViewing(null) : mode === "signup" ? onCancel() : undefined)}
      onDismiss={onDismiss}
    >
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, paddingTop: 10, backgroundColor: mono.bg }}>
          <TopBar
            left={
              viewing ? (
                <IconButton icon="back" label={t("common.back")} onPress={() => setViewing(null)} />
              ) : mode === "signup" ? (
                <IconButton icon="close" label={t("common.close")} onPress={onCancel} />
              ) : undefined
            }
          />
          {viewing ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 48 }}>
              <LegalText doc={legalDocument(viewing, legalLang(lang))} />
            </ScrollView>
          ) : (
            <>
              <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 24, gap: 18 }}>
                <Text accessibilityRole="header" style={[textRole.pageTitle, { color: mono.ink }]}>
                  {t(mode === "signup" ? "legal.signupTitle" : "legal.renewTitle")}
                </Text>
                <Text style={[textRole.body, { color: mono.gray }]}>{t(mode === "signup" ? "legal.signupBody" : "legal.renewBody")}</Text>
                <CheckRow big checked={all} label={t("legal.all")} onPress={() => setChecked(all ? [] : ACCOUNT_ITEMS)} />
                <View>
                  {ACCOUNT_ROWS.map((row) => (
                    <CheckRow
                      key={row.item}
                      checked={checked.includes(row.item)}
                      tag={t("legal.required")}
                      label={t(row.label)}
                      onPress={() => toggle(row.item)}
                      onView={row.doc ? () => setViewing(row.doc!) : undefined}
                    />
                  ))}
                </View>
                <TextLink body title={t("legal.privacy")} label={t("legal.viewLabel", { name: t("legal.privacy") })} onPress={() => setViewing("privacy")} style={{ alignSelf: "flex-start" }} />
                <Text lineBreakStrategyIOS="hangul-word" style={[textRole.body, { color: mono.gray }]}>{t("legal.refuseNote")}</Text>
              </ScrollView>
              <View style={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 12, gap: 10, borderTopWidth: 1, borderColor: mono.hair, backgroundColor: mono.bg }}>
                <SolidButton title={t("legal.agree")} disabled={!all} onPress={() => onAgree(checked)} />
                {mode === "renew" && <LineButton title={t("legal.signOut")} onPress={onCancel} />}
              </View>
            </>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function CheckRow({ checked, label, tag, big, onPress, onView }: { checked: boolean; label: string; tag?: string; big?: boolean; onPress: () => void; onView?: () => void }) {
  const { t } = useI18n();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: big ? 60 : 54,
        ...(big ? { borderWidth: stroke.chip, borderColor: mono.ink, paddingHorizontal: 14 } : { borderBottomWidth: 1, borderColor: mono.hair }),
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={tag ? `${tag}, ${label}` : label}
        onPress={onPress}
        style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, opacity: pressed ? 0.6 : 1 })}
      >
        <Check done={checked} size={big ? 24 : 22} />
        <Text style={[big ? textRole.sectionTitle : textRole.itemTitle, { flex: 1, color: mono.ink }]}>
          {tag && <Text style={textRole.itemTitle}>{`[${tag}] `}</Text>}
          {label}
        </Text>
      </Pressable>
      {onView && (
        <TextLink tone="dismiss" body title={t("legal.view")} label={t("legal.viewLabel", { name: label })} onPress={onView} style={{ minWidth: 44, alignItems: "flex-end" }} />
      )}
    </View>
  );
}

/** AI·장소 기능 동의. 기능 버튼을 처음 누르면 뜨고, 그 기능의 동의서 전문을 시트 모양으로 보인 뒤 버튼으로 동의를 받는다. */
function AiConsentSheet({
  feature,
  visible,
  saving,
  failed,
  onAgree,
  onCancel,
  onDismiss,
}: {
  feature: AiFeature;
  visible: boolean;
  saving: boolean;
  failed: boolean;
  onAgree: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel} onDismiss={onDismiss}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, paddingTop: 10, backgroundColor: mono.bg }}>
          <TopBar left={<IconButton icon="close" label={t("common.close")} disabled={saving} onPress={onCancel} />} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 24 }}>
            <LegalText doc={legalDocument(aiDocId(feature), legalLang(lang))} sheet />
          </ScrollView>
          <View style={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 12, gap: 10, borderTopWidth: 1, borderColor: mono.hair, backgroundColor: mono.bg }}>
            {failed && (
              <Text accessibilityRole="alert" style={[textRole.itemTitle, { color: mono.warn }]}>
                {t("legal.saveFailed")}
              </Text>
            )}
            <SolidButton title={t(AI_AGREE[feature])} disabled={saving} onPress={onAgree} />
            <LineButton title={t("legal.aiLater")} disabled={saving} onPress={onCancel} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function DocumentSheet({ doc, onClose }: { doc: LegalDocId | "licenses" | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Modal visible={!!doc} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, paddingTop: 10, backgroundColor: mono.bg }}>
          <TopBar left={<IconButton icon="close" label={t("common.close")} onPress={onClose} />} />
          {doc === "licenses" ? (
            <Licenses />
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 48 }}>
              {doc && <LegalText doc={legalDocument(doc, legalLang(lang))} />}
            </ScrollView>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
