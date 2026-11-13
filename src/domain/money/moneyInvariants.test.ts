import { describe, expect, it } from "vitest";
import { settleBalances } from "./settleBalances";
import { summarizeLedger } from "./summarizeLedger";
import type {
  ConvertibleAmount,
  CurrencyCode,
  LedgerExpense,
  MoneyLedger,
} from "./types";

const CURRENCIES: CurrencyCode[] = ["KRW", "JPY", "USD"];

/** 시드를 고정한 난수(mulberry32). 실패한 시드로 같은 장부를 다시 만들 수 있다. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** 합이 0인 묶음의 최대 개수를 전수 탐색으로 센다. 작은 입력에서만 쓴다. */
function maxZeroSumGroups(values: number[]): number {
  if (values.length === 0) return 0;
  const [first, ...rest] = values;
  let best = 0;
  for (let mask = 0; mask < 1 << rest.length; mask += 1) {
    let sum = first;
    const remaining: number[] = [];
    rest.forEach((value, index) => {
      if ((mask & (1 << index)) !== 0) sum += value;
      else remaining.push(value);
    });
    if (sum === 0) best = Math.max(best, 1 + maxZeroSumGroups(remaining));
  }
  return best;
}

function randomLedger(seed: number): MoneyLedger {
  const random = createRandom(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];

  const baseCurrency = pick(CURRENCIES);
  const members = Array.from({ length: int(2, 7) }, (_, index) => ({
    id: `m${index}`,
    name: `동행자${index}`,
  }));
  const memberIds = members.map((member) => member.id);

  const money = (): ConvertibleAmount => {
    const currency = pick(CURRENCIES);
    const fraction = String(int(1, 999_999)).padStart(6, "0");
    return {
      amount: int(1, 2_000_000),
      currency,
      rateToBase: currency === baseCurrency ? "1" : `${int(0, 1_500)}.${fraction}`,
    };
  };

  const expenses = Array.from({ length: int(0, 12) }, (_, index): LedgerExpense => {
    const entry = money();
    const chosen = memberIds.filter(() => random() < 0.6);
    const sharers = chosen.length > 0 ? chosen : [pick(memberIds)];
    const cuts = sharers
      .slice(1)
      .map(() => int(0, entry.amount))
      .sort((left, right) => left - right);
    const bounds = [0, ...cuts, entry.amount];

    return {
      id: `e${index}`,
      ...entry,
      paidBy:
        random() < 0.2
          ? { kind: "fund" }
          : { kind: "member", memberId: pick(memberIds) },
      split:
        random() < 0.5
          ? { kind: "even", memberIds: sharers }
          : {
              kind: "custom",
              shares: sharers.map((memberId, at) => ({
                memberId,
                amount: bounds[at + 1] - bounds[at],
              })),
            },
    };
  });

  return {
    baseCurrency,
    members,
    fundHolderId: pick(memberIds),
    expenses,
    fundContributions: Array.from({ length: int(0, 4) }, (_, index) => ({
      id: `c${index}`,
      memberId: pick(memberIds),
      ...money(),
    })),
    payments: Array.from({ length: int(0, 3) }, (_, index) => {
      const fromMemberId = pick(memberIds);
      const toMemberId = pick(memberIds.filter((memberId) => memberId !== fromMemberId));
      return { id: `p${index}`, fromMemberId, toMemberId, amount: int(1, 500_000) };
    }),
  };
}

describe("돈 계산 불변식", () => {
  it("무작위 장부 300개에서 합계와 정산이 1단위도 어긋나지 않는다", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const context = `seed ${seed}`;
      const summary = summarizeLedger(randomLedger(seed));

      expect(
        summary.members.reduce((sum, member) => sum + member.balance, 0),
        context,
      ).toBe(0);
      expect(
        summary.members.reduce((sum, member) => sum + member.share, 0),
        context,
      ).toBe(summary.totalSpent);
      expect(summary.fund.remaining, context).toBe(
        summary.fund.contributed - summary.fund.spent,
      );

      const transfers = settleBalances(summary.members);
      const left = new Map(
        summary.members.map((member) => [member.memberId, member.balance]),
      );
      for (const transfer of transfers) {
        expect(transfer.amount, context).toBeGreaterThan(0);
        expect(transfer.fromMemberId, context).not.toBe(transfer.toMemberId);
        left.set(
          transfer.fromMemberId,
          (left.get(transfer.fromMemberId) ?? 0) + transfer.amount,
        );
        left.set(
          transfer.toMemberId,
          (left.get(transfer.toMemberId) ?? 0) - transfer.amount,
        );
      }
      expect([...left.values()].every((balance) => balance === 0), context).toBe(true);

      const owing = summary.members.filter((member) => member.balance !== 0).length;
      expect(transfers.length, context).toBeLessThanOrEqual(Math.max(owing - 1, 0));
    }
  });

  it("9명 이하 무작위 차액 1,000개에서 송금 횟수가 전수 탐색한 최소와 같다", () => {
    const random = createRandom(42);
    for (let round = 0; round < 1_000; round += 1) {
      const size = 2 + Math.floor(random() * 8);
      const values = Array.from(
        { length: size - 1 },
        () => Math.floor(random() * 21) - 10,
      );
      values.push(-values.reduce((sum, value) => sum + value, 0));
      const owing = values.filter((value) => value !== 0);
      const minimum = owing.length === 0 ? 0 : owing.length - maxZeroSumGroups(owing);

      const transfers = settleBalances(
        values.map((balance, index) => ({ memberId: `p${index}`, balance })),
      );
      expect(transfers.length, JSON.stringify(values)).toBe(minimum);
    }
  });
});
