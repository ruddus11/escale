import type { TimelineItem } from "./dayPlan";

// JEV가 오늘 탭 맨 위에서 먼저 건네는 말. 한 목소리로 "지금 상태 + 다음 행동"을 짧게 말한다.
// 근거가 있는 것만 말한다: 일정 시각, 예약 시각, 적은 지출과 정한 예산, 준비물 개수.
// 이동 시간은 앱이 계산하지 않으므로 "지금 출발" 기준은 고정 여유(아래 LEAD)로 정하고 그 값을 문구에 드러내지 않는다.

/** 이만큼 남으면 "지금 출발해야 해요"라고 말한다(분). 비행기는 공항 수속을 감안한다. */
export const LEAD = { plan: 30, transport: 40, flight: 180 } as const;
/** 하루 예산을 이만큼 넘게 쓰면 알린다(%). */
const BUDGET_NOTICE = 70;

export type JevNudge =
  | { kind: "leave"; title: string; minutes: number; time: string }
  | { kind: "next"; title: string; minutes: number; time: string }
  | { kind: "budget"; percent: number }
  | { kind: "overBudget"; over: number }
  | { kind: "dayClear" }
  | { kind: "countdown"; days: number }
  | { kind: "packing"; left: number }
  | { kind: "addBookings" }
  | { kind: "tripDone" };

export interface NudgeInput {
  phase: "before" | "during" | "after";
  now: Date;
  /** 오늘 남은 첫 일정(이미 시작한 것 포함) */
  next?: TimelineItem;
  /** 오늘 쓴 돈·하루 예산(정산 통화 최소 단위). 예산이 없으면 undefined */
  spent: number;
  dailyBudget?: number;
  /** 출발까지 남은 날 */
  until: number;
  packingLeft: number;
  packingTotal: number;
  reservations: number;
}

function leadFor(item: TimelineItem): number {
  if (item.kind === "move") return item.reservation.kind === "flight" ? LEAD.flight : LEAD.transport;
  return LEAD.plan;
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** 중요한 순서로 최대 두 마디. */
export function jevNudges(input: NudgeInput): JevNudge[] {
  const out: JevNudge[] = [];
  if (input.phase === "during") {
    const { next } = input;
    if (next?.startAt !== undefined && next.start !== undefined) {
      const minutes = Math.round((next.startAt - input.now.getTime()) / 60000);
      if (minutes > 0) out.push({ kind: minutes <= leadFor(next) ? "leave" : "next", title: next.title, minutes, time: hhmm(next.start) });
    } else if (!next) out.push({ kind: "dayClear" });
    if (input.dailyBudget && input.dailyBudget > 0) {
      if (input.spent > input.dailyBudget) out.push({ kind: "overBudget", over: input.spent - input.dailyBudget });
      else {
        const percent = Math.floor((input.spent / input.dailyBudget) * 100);
        if (percent >= BUDGET_NOTICE) out.push({ kind: "budget", percent });
      }
    }
  } else if (input.phase === "before") {
    out.push({ kind: "countdown", days: input.until });
    if (!input.reservations) out.push({ kind: "addBookings" });
    else if (input.packingTotal && input.packingLeft) out.push({ kind: "packing", left: input.packingLeft });
  } else out.push({ kind: "tripDone" });
  // 출발 알림이 있으면 그것이 먼저다. 예산 넘침은 다음 일정보다 먼저 본다.
  const rank: Record<JevNudge["kind"], number> = { leave: 0, overBudget: 1, next: 2, budget: 3, dayClear: 4, countdown: 0, addBookings: 1, packing: 2, tripDone: 0 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 2);
}
