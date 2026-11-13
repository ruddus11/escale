import { CurrencySelect } from "../components/SearchSelect";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { convertToBase, formatMoney, isCurrencyCode, moneyInput, parseMoney, parseRate } from "../../../src/domain/money/currency";
import { zonedDate } from "../../../src/domain/time/zoned";
import type { ExpenseCategory, TripExpense, TripWorkspace } from "../../../src/domain/workspace/types";
import { CATEGORIES, envelopesFor, guessCategory, knownRate, plainAmount } from "../data/budgetPlan";
import { frequentExpenses, type ExpenseShortcut } from "../data/expenseShortcuts";
import { fetchRate } from "../data/rates";
import { useI18n } from "../i18n/I18n";
import { Caps, Chip, LineButton, SolidButton, Swatch } from "../theme/mono";
import { mono, space, stroke, textRole } from "../theme/tokens";
import { categoryKey } from "./BudgetPage";

/** 여행 도구에서 읽었지만 환율이 없어 저장하지 못한 지출. 새 지출로 열어 마저 적는다. */
export type ExpenseDraft = Pick<TripExpense, "title" | "currency" | "category" | "method"> & { amount?: number };

// 지출 한 건. 큰 금액 하나, 어디에 썼는지, 분류, 결제 수단 순서로 적는다.
export function ExpenseEditor({
  trip,
  initial,
  draft,
  history,
  saving,
  onSave,
  onCancel,
}: {
  trip: TripWorkspace;
  initial?: TripExpense;
  draft?: ExpenseDraft;
  /** 이 기기의 다른 수첩 지출. 자주 쓰는 지출을 찾는 데만 쓴다. */
  history?: readonly TripExpense[];
  saving: boolean;
  onSave: (expense: TripExpense) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const seed = initial ?? draft;
  const [title, setTitle] = useState(seed?.title ?? ""),
    [amount, setAmount] = useState(seed?.amount !== undefined ? moneyInput(seed.amount, seed.currency) : ""),
    [currency, setCurrency] = useState<string>(seed?.currency ?? trip.settings.localCurrency),
    [rate, setRate] = useState(initial?.rateToBase ?? ""),
    [method, setMethod] = useState<"card" | "cash">(seed?.method ?? "card"),
    [category, setCategory] = useState<ExpenseCategory>(seed?.category ?? "other"),
    // 사용자가 분류를 직접 고르면 메모를 고쳐도 자동으로 바꾸지 않는다. 고치거나 이어 적는 지출은 이미 고른 것으로 본다.
    [picked, setPicked] = useState(!!seed),
    [error, setError] = useState(""),
    // 환율 칸 아래 한 줄: 어디서 가져온 값인지. 직접 고치면 지운다.
    [rateNote, setRateNote] = useState("");
  // 동행자가 있으면 낸 사람과 나눌 사람을 고른다. 공금 결제·금액을 직접 나눈 지출은 원래 값을 그대로 둔다.
  const members = trip.settings.members;
  const [payer, setPayer] = useState(initial?.paidBy.kind === "member" ? initial.paidBy.memberId : trip.settings.ownerId);
  const [splitIds, setSplitIds] = useState<string[]>(() => {
    if (initial?.split.kind === "even") return initial.split.memberIds;
    return initial ? [] : members.map((m) => m.id);
  });
  const editSplit = members.length > 1 && initial?.split.kind !== "custom";
  const editPayer = members.length > 1 && initial?.paidBy.kind !== "fund";
  const base = trip.settings.baseCurrency;
  // 새 지출에만 보인다. 이 여행의 현지·정산 통화로 쓴 묶음만 고른다.
  const shortcuts = useMemo(
    () => (seed ? [] : frequentExpenses([...trip.ledger.expenses, ...(history ?? [])], { currencies: [trip.settings.localCurrency, base] })),
    [seed, trip.ledger.expenses, history, trip.settings.localCurrency, base],
  );
  // 칸만 채우고 저장은 사용자가 확인한 뒤 한다. 환율은 통화가 바뀌면 위 효과가 채운다.
  function applyShortcut(s: ExpenseShortcut) {
    setTitle(s.title);
    setAmount(moneyInput(s.amount, s.currency));
    setCurrency(s.currency);
    setMethod(s.method);
    setCategory(s.category);
    setPicked(true);
    setError("");
  }
  // 통화를 고르면 환율을 채운다: 이 여행에서 마지막에 쓴 값, 없으면 오늘 기준가. 고치던 지출의 원래 통화는 건드리지 않는다.
  useEffect(() => {
    if (!isCurrencyCode(currency) || currency === base || (initial && currency === initial.currency)) {
      setRateNote("");
      return;
    }
    const last = knownRate(trip, currency);
    if (last) {
      setRate(last);
      setRateNote(t("expense.rateLast"));
      return;
    }
    let alive = true;
    setRate("");
    setRateNote(t("expense.rateLoading"));
    void fetchRate(currency, base).then((live) => {
      if (!alive) return;
      if (live) setRate(live.rate);
      setRateNote(live ? t("expense.rateLive", { date: live.date }) : t("expense.rateManual"));
    });
    return () => {
      alive = false;
    };
    // 통화가 바뀔 때만 다시 채운다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);
  const inBase = baseAmount(amount, currency, currency === base ? "1" : rate, base);
  const envelope = envelopeAfter(trip, initial, category, inBase);
  async function save() {
    if (!isCurrencyCode(currency)) {
      setError(t("expense.currencyError"));
      return;
    }
    const minor = parseMoney(amount, currency),
      rateToBase = currency === trip.settings.baseCurrency ? "1" : rate;
    if (!title.trim() || minor === undefined || minor <= 0 || !parseRate(rateToBase)) {
      setError(t("expense.checkError"));
      return;
    }
    if (editSplit && !splitIds.length) {
      setError(t("expense.splitNone"));
      return;
    }
    const expense: TripExpense = {
      id: initial?.id ?? randomUUID(),
      title: title.trim(),
      amount: minor,
      currency,
      rateToBase,
      method,
      category,
      paidBy: editPayer ? { kind: "member", memberId: payer } : initial?.paidBy ?? { kind: "member", memberId: trip.settings.ownerId },
      // 고른 순서가 아니라 동행자 순서로 저장한다. 남는 1원 배분 순서가 늘 같게.
      split: editSplit ? { kind: "even", memberIds: members.map((m) => m.id).filter((id) => splitIds.includes(id)) } : initial?.split ?? { kind: "even", memberIds: [trip.settings.ownerId] },
      occurredAt: initial?.occurredAt ?? new Date().toISOString(),
    };
    try {
      await onSave(expense);
    } catch {
      setError(t("expense.saveError"));
    }
  }
  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 14, paddingBottom: 48, gap: 26 }}>
      <Caps color={mono.ink} style={{ alignSelf: "center" }}>
        {t(initial ? "expense.edit" : "expense.new")}
      </Caps>

      {shortcuts.length > 0 && (
        <View style={{ gap: 10 }}>
          <Caps color={mono.ink}>{t("shortcut.title")}</Caps>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {shortcuts.map((s) => {
              const money = formatMoney(s.amount, s.currency);
              const on = title === s.title && currency === s.currency && method === s.method && category === s.category && parseMoney(amount, s.currency) === s.amount;
              return (
                <ShortcutChip
                  key={`${s.category}-${s.amount}-${s.currency}-${s.method}-${s.title}`}
                  title={`${shortTitle(s.title)} ${money}`}
                  // 잘린 제목만 읽으면 분류·결제 수단만 다른 두 칩이 같게 들린다. 전체 내용을 읽힌다.
                  label={[s.title, t(categoryKey(s.category)), t(s.method === "card" ? "expense.card" : "expense.cash"), money].join(", ")}
                  selected={on}
                  category={s.category}
                  disabled={saving}
                  onPress={() => applyShortcut(s)}
                />
              );
            })}
          </View>
          <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{t("shortcut.hint")}</Text>
        </View>
      )}

      <View style={{ alignItems: "center", gap: 6 }}>
        <CurrencySelect compact label={t("expense.currency")} value={currency} onChange={setCurrency} />
        <TextInput
          accessibilityLabel={t("expense.amount")}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          maxLength={16}
          placeholder="0"
          placeholderTextColor={mono.mutedText}
          style={{ alignSelf: "stretch", textAlign: "center", ...textRole.feature, color: mono.ink, paddingVertical: 2 }}
        />
        {currency !== base && inBase !== undefined && (
          <Text style={[textRole.meta, { fontVariant: ["tabular-nums"], color: mono.gray }]}>{t("expense.approx", { amount: formatMoney(inBase, base) })}</Text>
        )}
      </View>

      {currency !== trip.settings.baseCurrency && (
        <View style={{ gap: 6 }}>
          <Underline
            label={t("expense.rate", { from: currency, to: trip.settings.baseCurrency })}
            value={rate}
            onChange={(value) => {
              setRate(value);
              setRateNote("");
            }}
            keyboard="decimal-pad"
            maxLength={17}
          />
          {!!rateNote && <Text lineBreakStrategyIOS="hangul-word" style={[textRole.meta, { color: mono.gray }]}>{rateNote}</Text>}
        </View>
      )}

      <Underline
        label={t("expense.what")}
        value={title}
        maxLength={60}
        onChange={(value) => {
          setTitle(value);
          if (!picked) setCategory(guessCategory(value) ?? "other");
        }}
      />

      <View style={{ gap: 10 }}>
        <Caps color={mono.ink}>{t("expense.category")}</Caps>
        <View accessibilityRole="radiogroup" accessibilityLabel={t("expense.category")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              role="radio"
              title={t(categoryKey(c.key))}
              selected={category === c.key}
              left={<Swatch category={c.key} size={9} onDark={category === c.key} />}
              onPress={() => {
                setCategory(c.key);
                setPicked(true);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Caps color={mono.ink}>{t("expense.paidBy")}</Caps>
        <View accessibilityRole="radiogroup" accessibilityLabel={t("expense.paidBy")} style={{ flexDirection: "row", gap: 8 }}>
          {(["card", "cash"] as const).map((m) =>
            method === m ? (
              <SolidButton key={m} checked title={t(m === "card" ? "expense.card" : "expense.cash")} style={{ flex: 1 }} onPress={() => setMethod(m)} />
            ) : (
              <LineButton key={m} checked={false} title={t(m === "card" ? "expense.card" : "expense.cash")} style={{ flex: 1 }} onPress={() => setMethod(m)} />
            ),
          )}
        </View>
      </View>

      {editPayer && (
        <View style={{ gap: 10 }}>
          <Caps color={mono.ink}>{t("expense.payer")}</Caps>
          <View accessibilityRole="radiogroup" accessibilityLabel={t("expense.payer")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {members.map((m) => (
              <Chip key={m.id} role="radio" title={m.name} selected={payer === m.id} onPress={() => setPayer(m.id)} />
            ))}
          </View>
        </View>
      )}

      {editSplit && (
        <View style={{ gap: 10 }}>
          <Caps color={mono.ink}>{t("expense.splitWith")}</Caps>
          <View accessibilityLabel={t("expense.splitWith")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {members.map((m) => (
              <Chip key={m.id} role="checkbox" title={m.name} selected={splitIds.includes(m.id)} onPress={() => setSplitIds((ids) => (ids.includes(m.id) ? ids.filter((id) => id !== m.id) : [...ids, m.id]))} />
            ))}
          </View>
        </View>
      )}

      {envelope && (
        <View
          accessible
          accessibilityLabel={t("expense.envelopeLeft", { name: t(categoryKey(category)), before: plainAmount(envelope.before, base), after: envelope.after < 0 ? t("expense.envelopeOver", { amount: plainAmount(-envelope.after, base) }) : plainAmount(envelope.after, base) })}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: mono.ink }}
        >
          <Text style={[textRole.meta, { flexShrink: 1, color: mono.ink }]}>{t("expense.envelope", { name: t(categoryKey(category)) })}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={[textRole.meta, { fontVariant: ["tabular-nums"], color: mono.gray }]}>{plainAmount(envelope.before, base)}</Text>
            <Text style={[textRole.meta, { color: mono.ink }]}>→</Text>
            <Text style={[textRole.sectionTitle, { fontVariant: ["tabular-nums"], color: envelope.after < 0 ? mono.warn : mono.ink }]}>
              {envelope.after < 0 ? t("expense.envelopeOver", { amount: plainAmount(-envelope.after, base) }) : plainAmount(envelope.after, base)}
            </Text>
          </View>
        </View>
      )}

      {!!error && (
        <Text accessibilityRole="alert" style={[textRole.meta, { color: mono.warn }]}>
          {error}
        </Text>
      )}
      <SolidButton title={saving ? t("money.saving") : t("expense.save")} disabled={saving} onPress={() => void save()} />
      <LineButton title={t("common.cancel")} disabled={saving} onPress={onCancel} />
    </ScrollView>
  );
}

// 칩은 줄바꿈하지 않으므로 큰 글자에서도 한 줄에 들어가게 메모를 줄인다. 예: "Family Mart Shinjuku" → "Family Mart Sh…".
const shortTitle = (text: string) => (text.length > 14 ? `${text.slice(0, 14).trimEnd()}…` : text);

function Underline({ label, value, onChange, keyboard, maxLength }: { label: string; value: string; onChange: (value: string) => void; keyboard?: "decimal-pad"; maxLength?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1.5, borderColor: mono.ink }}>
      <Text style={[textRole.label, { color: mono.ink, maxWidth: "45%" }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        maxLength={maxLength}
        autoCorrect={false}
        style={[textRole.sectionTitle, { flex: 1, minHeight: 48, color: mono.ink }]}
      />
    </View>
  );
}

/** 적는 중인 금액을 정산 통화로. 금액·통화·환율 중 하나라도 아직 맞지 않으면 undefined. */
function baseAmount(text: string, currency: string, rateToBase: string, base: TripWorkspace["settings"]["baseCurrency"]) {
  if (!isCurrencyCode(currency) || !parseRate(rateToBase)) return undefined;
  const minor = parseMoney(text, currency);
  return minor === undefined || minor <= 0 ? undefined : convertToBase({ amount: minor, currency, rateToBase }, base);
}

/** 고른 분류의 그날 봉투가 이 지출로 얼마에서 얼마가 되는지. 하루 예산이 없으면 보여주지 않는다. */
function envelopeAfter(trip: TripWorkspace, initial: TripExpense | undefined, category: ExpenseCategory, inBase: number | undefined) {
  if (inBase === undefined) return undefined;
  const tz = trip.settings.timeZone;
  const date = zonedDate(initial?.occurredAt ?? new Date().toISOString(), tz);
  const envelope = envelopesFor(trip, date).envelopes.find((e) => e.key === category);
  if (envelope?.limit === undefined) return undefined;
  // 고치는 중이면 원래 금액은 이미 봉투에서 빠져 있으니 되돌려 놓고 계산한다.
  const own = initial && initial.category === category && zonedDate(initial.occurredAt, tz) === date ? convertToBase(initial, trip.settings.baseCurrency) : 0;
  const before = envelope.limit - (envelope.spent - own);
  return { before, after: before - inBase };
}

// 공용 Chip은 보이는 글자를 그대로 읽으므로, 읽기 이름을 따로 주려고 같은 모양으로 둔다.
function ShortcutChip({ title, label, selected, category, disabled, onPress }: { title: string; label: string; selected: boolean; category: ExpenseCategory; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 13,
        borderWidth: stroke.chip,
        borderColor: mono.ink,
        backgroundColor: selected ? mono.ink : "transparent",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Swatch category={category} size={9} onDark={selected} />
      <Text style={[textRole.meta, { fontWeight: "600", color: selected ? mono.bg : mono.ink }]}>{title}</Text>
    </Pressable>
  );
}
