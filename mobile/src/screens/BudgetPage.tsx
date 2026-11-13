import { KeyedError } from "../i18n/errors";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import type { ExpenseCategory, TripExpense, TripWorkspace } from "../../../src/domain/workspace/types";
import type { SettlementTransfer } from "../../../src/domain/money/settleBalances";
import { zonedDate } from "../../../src/domain/time/zoned";
import { formatMoney } from "../../../src/domain/money/currency";
import { expenseGroups, notebookDay, shortDate } from "../data/notebookView";
import { envelopesFor, formatShort, plainAmount, prepaid } from "../data/budgetPlan";
import { buildSettlementView, canRecordTransfer } from "../data/settlementView";
import { TripBudgetSummary } from "../components/TripBudgetSummary";
import { useReceipt } from "../components/useReceipt";
import type { ExpenseDraft } from "./ExpenseEditor";
import { useI18n } from "../i18n/I18n";
import { formatDay, type Key } from "../i18n/strings";
import { Bar, Card, EmptyState, LineButton, SectionHead, Segmented, SolidButton, Swatch, TextLink } from "../theme/mono";
import { mono, space, textRole } from "../theme/tokens";
import { reservationKindKey } from "./Reservations";

export type MoneyView = "expenses" | "settle";

export const categoryKey = (key: ExpenseCategory) => `cat.${key}` as Key;

// 돈 탭. 예산 요약 아래에 지출(날짜별, 여행 기간 밖은 따로)과 동행자 정산 두 보기.
export function BudgetPage({
  trip,
  now,
  saving,
  view,
  setView,
  expense,
  expenseDraft,
  budget,
  openMembers,
  recordPayment,
  removePayment,
}: {
  trip: TripWorkspace;
  now: Date;
  saving: boolean;
  view: MoneyView;
  setView: (view: MoneyView) => void;
  expense: (id?: string) => void;
  expenseDraft: (draft: ExpenseDraft) => void;
  budget: () => void;
  openMembers: () => void;
  recordPayment: (transfer: SettlementTransfer) => Promise<void>;
  removePayment: (id: string) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const base = trip.settings.baseCurrency;
  const { phase, today } = notebookDay(trip.settings, now);
  const receipt = useReceipt(trip.settings.localCurrency, expenseDraft, (d) => t(categoryKey(d.category)));
  const groups = expenseGroups(trip);
  const inside = groups.filter((g) => g.date >= trip.settings.startDate && g.date <= trip.settings.endDate);
  const outside = groups.filter((g) => g.date < trip.settings.startDate || g.date > trip.settings.endDate);
  const day = envelopesFor(trip, today);
  const group = trip.settings.members.length > 1;
  const nameOf = (id: string) => trip.settings.members.find((m) => m.id === id)?.name ?? "?";

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 12, paddingBottom: 40, gap: space.section }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text accessibilityRole="header" style={[textRole.display, { color: mono.ink }]}>{t("money2.title")}</Text>
        <SolidButton icon="plus" title={t("money2.add")} disabled={saving} onPress={() => expense()} style={{ minHeight: 40, paddingHorizontal: 16 }} />
      </View>

      <Card style={{ gap: 12 }}>
        <TripBudgetSummary trip={trip} onPress={budget} compact />
        {phase === "during" && day.daily !== undefined && (
          <Pressable accessibilityRole="button" onPress={budget} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[textRole.meta, { color: mono.gray }]}>{t("now.spent")}</Text>
              <Text style={[textRole.meta, { color: day.spent > day.daily ? mono.warn : mono.ink, fontVariant: ["tabular-nums"] }]}>{`${formatMoney(day.spent, base)} / ${formatMoney(day.daily, base)}`}</Text>
            </View>
            <Bar ratio={day.daily ? day.spent / day.daily : 0} color={day.spent > day.daily ? mono.warn : mono.accent} />
          </Pressable>
        )}
      </Card>

      {receipt.available && <LineButton icon="camera" title={receipt.reading ? t("receipt.reading") : t("money2.receipt")} disabled={saving || receipt.reading} onPress={receipt.start} />}

      <Segmented items={[{ key: "expenses", title: t("money2.expenses"), icon: "list" }, { key: "settle", title: t("money2.settle"), icon: "users" }]} value={view} onChange={setView} label={t("money2.views")} />

      {view === "expenses" ? (
        <View style={{ gap: space.section }}>
          {inside.map((g) => (
            <DayGroup key={g.date} title={formatDay(lang, g.date)} total={g.total} items={g.items} trip={trip} group={group} nameOf={nameOf} onOpen={expense} />
          ))}
          {!groups.length && <EmptyState text={t("money2.empty")} action={{ title: t("money2.add"), icon: "plus", onPress: () => expense(), disabled: saving }} />}
          {!!outside.length && (
            <View style={{ gap: 6 }}>
              <SectionHead title={t("money2.outside")} />
              <Text style={[textRole.meta, { color: mono.gray }]}>{t("money2.outsideNote")}</Text>
              {outside.map((g) => (
                <DayGroup key={g.date} title={shortDate(g.date, true)} total={g.total} items={g.items} trip={trip} group={group} nameOf={nameOf} onOpen={expense} />
              ))}
            </View>
          )}
          {!!prepaid(trip).length && (
            <View>
              <SectionHead title={t("money.alreadyPaid")} />
              {prepaid(trip).map((r) => (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48, borderBottomWidth: 1, borderColor: mono.hair }}>
                  <Text numberOfLines={1} style={[textRole.body, { flex: 1, color: mono.ink }]}>{r.title}</Text>
                  <Text style={[textRole.meta, { color: mono.gray }]}>{t(reservationKindKey[r.kind])}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Settlement trip={trip} saving={saving} openMembers={openMembers} recordPayment={recordPayment} removePayment={removePayment} />
      )}
    </ScrollView>
  );
}

function DayGroup({ title, total, items, trip, group, nameOf, onOpen }: { title: string; total: number; items: TripExpense[]; trip: TripWorkspace; group: boolean; nameOf: (id: string) => string; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const tz = trip.settings.timeZone;
  return (
    <View>
      <SectionHead title={title} right={<Text style={[textRole.meta, { color: mono.gray, fontVariant: ["tabular-nums"] }]}>{t("money2.dayTotal", { n: items.length, amount: formatMoney(total, trip.settings.baseCurrency) })}</Text>} />
      {items.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`${e.title || t(categoryKey(e.category))}, ${formatShort(e.amount, e.currency)}`}
          onPress={() => onOpen(e.id)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[textRole.meta, { width: 44, fontVariant: ["tabular-nums"], color: mono.gray }]}>{localTime(e.occurredAt, tz)}</Text>
          <Swatch category={e.category} size={8} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text numberOfLines={1} style={[textRole.itemTitle, { color: mono.ink }]}>{e.title || t(categoryKey(e.category))}</Text>
            {group && e.paidBy.kind === "member" && <Text style={[textRole.meta, { color: mono.gray }]}>{t("money2.paidBy", { name: nameOf(e.paidBy.memberId) })}</Text>}
          </View>
          <Text style={[textRole.itemTitle, { fontVariant: ["tabular-nums"], color: mono.ink }]}>{formatShort(e.amount, e.currency)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** 동행자 정산. 사람별 낸 돈·몫·차액, 남은 송금, 송금 기록. 실제 송금은 하지 않고 기록만 남긴다. */
function Settlement({ trip, saving, openMembers, recordPayment, removePayment }: { trip: TripWorkspace; saving: boolean; openMembers: () => void; recordPayment: (transfer: SettlementTransfer) => Promise<void>; removePayment: (id: string) => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const view = buildSettlementView(trip);
  const base = trip.settings.baseCurrency;
  const money = (n: number) => formatMoney(n, base);
  if (view.kind === "solo") return <EmptyState text={t("crew.solo")} action={{ title: t("crew.add"), icon: "users", onPress: openMembers, disabled: saving }} />;
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof KeyedError && error.key === "settle.stale") Alert.alert(t("settle.stale"));
      else Alert.alert(t("app.saveFailed"), t("app.saveFailedBody"));
    } finally {
      setBusy(false);
    }
  }
  function confirm(transfer: SettlementTransfer & { fromName: string; toName: string }) {
    Alert.alert(t("settle.confirmTitle", { from: transfer.fromName, to: transfer.toName, amount: money(transfer.amount) }), t("settle.confirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settle.record"),
        onPress: () =>
          void run(async () => {
            // 확인 창을 띄운 사이 지출이 바뀌었으면 옛 금액을 기록하지 않는다.
            if (!canRecordTransfer(trip, transfer)) return void Alert.alert(t("settle.stale"));
            await recordPayment(transfer);
          }),
      },
    ]);
  }
  return (
    <View style={{ gap: space.section }}>
      <View>
        <SectionHead title={t("crew.title")} right={<TextLink title={t("crew.edit")} disabled={saving} onPress={openMembers} />} />
        {view.kind === "invalid" ? (
          <Text style={[textRole.body, { color: mono.warn, paddingTop: space.group }]}>{t("settle.invalid")}</Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", minHeight: 36, alignItems: "center", borderBottomWidth: 1, borderColor: mono.hair }}>
              <Text style={[textRole.label, { flex: 1.2, color: mono.gray }]} />
              {(["settle.paid", "settle.share", "settle.balance"] as const).map((k) => (
                <Text key={k} style={[textRole.label, { flex: 1, textAlign: "right", fontWeight: "400", color: mono.gray }]}>{t(k)}</Text>
              ))}
            </View>
            {view.members.map((m) => (
              <View key={m.memberId} style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderBottomWidth: 1, borderColor: mono.hair }}>
                <Text numberOfLines={1} style={[textRole.itemTitle, { flex: 1.2, color: mono.ink }]}>{m.name}</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={[textRole.meta, { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"], color: mono.ink }]}>{plainAmount(m.paid, base)}</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={[textRole.meta, { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"], color: mono.ink }]}>{plainAmount(m.share, base)}</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={[textRole.meta, { flex: 1, textAlign: "right", fontWeight: "600", fontVariant: ["tabular-nums"], color: m.balance < 0 ? mono.warn : m.balance > 0 ? mono.accentText : mono.gray }]}>{`${m.balance > 0 ? "+" : ""}${plainAmount(m.balance, base)}`}</Text>
              </View>
            ))}
            <Text style={[textRole.meta, { color: mono.gray, paddingTop: 8 }]}>{t("settle.total", { amount: money(view.totalSpent) })}</Text>
          </>
        )}
      </View>

      {view.kind === "group" && (
        <View style={{ gap: space.group }}>
          <SectionHead title={t("settle.transfers")} right={busy ? <ActivityIndicator color={mono.gray} /> : undefined} />
          {view.transfers.length ? (
            view.transfers.map((tr) => (
              <Card key={`${tr.fromMemberId}-${tr.toMemberId}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={[textRole.itemTitle, { color: mono.ink }]}>{`${tr.fromName} → ${tr.toName}`}</Text>
                  <Text style={[textRole.pageTitle, { color: mono.ink, fontVariant: ["tabular-nums"] }]}>{money(tr.amount)}</Text>
                </View>
                <SolidButton title={t("settle.markPaid")} disabled={saving || busy} onPress={() => confirm(tr)} style={{ minHeight: 40, paddingHorizontal: 14 }} />
              </Card>
            ))
          ) : (
            <Text style={[textRole.body, { color: mono.accentText }]}>{t("settle.done")}</Text>
          )}
          {!!view.payments.length && (
            <View>
              <SectionHead title={t("settle.history")} />
              {view.payments.map((p) => (
                <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, borderBottomWidth: 1, borderColor: mono.hair }}>
                  <Text numberOfLines={1} style={[textRole.meta, { flex: 1, color: mono.ink }]}>{`${p.fromName} → ${p.toName} · ${money(p.amount)}`}</Text>
                  <Text style={[textRole.meta, { color: mono.gray }]}>{shortDate(zonedDate(p.paidAt, trip.settings.timeZone))}</Text>
                  <TextLink
                    title={t("settle.undo")}
                    tone="dismiss"
                    disabled={saving || busy}
                    onPress={() =>
                      Alert.alert(t("settle.undoTitle"), undefined, [
                        { text: t("common.cancel"), style: "cancel" },
                        { text: t("common.delete"), style: "destructive", onPress: () => void run(() => removePayment(p.id)) },
                      ])
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function localTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** 항공·숙소처럼 미리 결제한 예약. 하루 예산에는 넣지 않는다. 예산 나누기 화면이 쓴다. */
export function AlreadyPaid({ trip }: { trip: TripWorkspace }) {
  const { t } = useI18n();
  return (
    <View>
      <SectionHead title={t("money.alreadyPaid")} />
      {prepaid(trip).map((r) => (
        <View key={r.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 50, borderBottomWidth: 1, borderColor: mono.hair }}>
          <Text numberOfLines={1} style={[textRole.body, { flex: 1, color: mono.ink }]}>{r.title}</Text>
          <Text style={[textRole.meta, { color: mono.gray }]}>{t(reservationKindKey[r.kind])}</Text>
        </View>
      ))}
    </View>
  );
}
