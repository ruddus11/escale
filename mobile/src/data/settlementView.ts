import { KeyedError } from "../i18n/errors";
import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { toMoneyLedger } from "../../../src/domain/workspace/tripLedger";
import { summarizeLedger, type MemberMoneySummary } from "../../../src/domain/money/summarizeLedger";
import { settleBalances, type SettlementTransfer } from "../../../src/domain/money/settleBalances";

// 돈 탭의 동행자 정산. 계산은 돈 엔진(summarizeLedger·settleBalances)이 하고, 여기서는 화면에 쓸 모양으로만 묶는다.
// 금액은 모두 정산 통화 최소 단위 정수다. 송금 완료는 장부의 payments에 남아 다음 계산에 그대로 반영된다.

export interface SettlementRow extends MemberMoneySummary {
  name: string;
}

export type SettlementView =
  | { kind: "solo" }
  | { kind: "invalid" }
  | {
      kind: "group";
      totalSpent: number;
      members: SettlementRow[];
      /** 아직 남은 송금. 비어 있으면 정산이 끝났다. */
      transfers: (SettlementTransfer & { fromName: string; toName: string })[];
      /** 지금까지 기록한 송금 완료. 최근 것이 앞. */
      payments: { id: string; fromName: string; toName: string; amount: number; paidAt: string }[];
    };

export function buildSettlementView(trip: TripWorkspace): SettlementView {
  const members = trip.settings.members;
  if (members.length < 2) return { kind: "solo" };
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";
  let summary;
  try {
    summary = summarizeLedger(toMoneyLedger(trip));
  } catch {
    // 지운 동행자를 가리키는 지출처럼 장부가 맞지 않으면 계산하지 않고 알린다.
    return { kind: "invalid" };
  }
  const transfers = settleBalances(summary.members.map(({ memberId, balance }) => ({ memberId, balance })));
  return {
    kind: "group",
    totalSpent: summary.totalSpent,
    members: summary.members.map((m) => ({ ...m, name: name(m.memberId) })),
    transfers: transfers.map((t) => ({ ...t, fromName: name(t.fromMemberId), toName: name(t.toMemberId) })),
    payments: [...trip.ledger.payments]
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .map((p) => ({ id: p.id, fromName: name(p.fromMemberId), toName: name(p.toMemberId), amount: p.amount, paidAt: p.paidAt })),
  };
}

/** 같은 송금을 두 번 누르거나 남은 차액보다 많이 기록하지 않게, 지금 남은 송금 목록과 맞는지 본다. */
export function canRecordTransfer(trip: TripWorkspace, transfer: SettlementTransfer): boolean {
  const view = buildSettlementView(trip);
  return (
    view.kind === "group" &&
    view.transfers.some((t) => t.fromMemberId === transfer.fromMemberId && t.toMemberId === transfer.toMemberId && t.amount === transfer.amount)
  );
}


/** 확인창을 연 뒤 장부가 바뀔 수 있어 저장 트랜잭션의 최신 여행으로 다시 검사한다. */
export function recordSettlementPayment(trip: TripWorkspace, transfer: SettlementTransfer, id: string, paidAt: string): TripWorkspace {
  if (!canRecordTransfer(trip, transfer)) throw new KeyedError("settle.stale");
  return {
    ...trip,
    ledger: {
      ...trip.ledger,
      payments: [...trip.ledger.payments, { id, fromMemberId: transfer.fromMemberId, toMemberId: transfer.toMemberId, amount: transfer.amount, paidAt }],
    },
  };
}
