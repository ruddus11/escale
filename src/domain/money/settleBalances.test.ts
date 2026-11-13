import { describe, expect, it } from "vitest";
import {
  settleBalances,
  type MemberBalance,
  type SettlementTransfer,
} from "./settleBalances";

function balances(entries: Record<string, number>): MemberBalance[] {
  return Object.entries(entries).map(([memberId, balance]) => ({ memberId, balance }));
}

function applyTransfers(input: MemberBalance[], transfers: SettlementTransfer[]) {
  const left = new Map(input.map(({ memberId, balance }) => [memberId, balance]));
  for (const { fromMemberId, toMemberId, amount } of transfers) {
    left.set(fromMemberId, (left.get(fromMemberId) ?? 0) + amount);
    left.set(toMemberId, (left.get(toMemberId) ?? 0) - amount);
  }
  return [...left.values()];
}

describe("settleBalances", () => {
  it("캔버스 정산 결과처럼 3번 보내면 끝난다", () => {
    expect(
      settleBalances(
        balances({ me: 138_415, minjun: 8_415, seoyeon: -35_245, doyun: -111_585 }),
      ),
    ).toEqual([
      { fromMemberId: "doyun", toMemberId: "me", amount: 111_585 },
      { fromMemberId: "seoyeon", toMemberId: "me", amount: 26_830 },
      { fromMemberId: "seoyeon", toMemberId: "minjun", amount: 8_415 },
    ]);
  });

  it("보냄 표시 뒤에는 남은 2건만 보낸다", () => {
    expect(
      settleBalances(
        balances({ me: 111_585, minjun: 8_415, seoyeon: -8_415, doyun: -111_585 }),
      ),
    ).toEqual([
      { fromMemberId: "doyun", toMemberId: "me", amount: 111_585 },
      { fromMemberId: "seoyeon", toMemberId: "minjun", amount: 8_415 },
    ]);
  });

  it("합이 0인 묶음을 먼저 찾아 큰 쪽끼리만 맞출 때보다 적게 보낸다", () => {
    // 큰 쪽끼리만 맞추면 d→a 4, e→b 3, d→c 2, e→c 1로 4번
    expect(settleBalances(balances({ a: 4, b: 3, c: 3, d: -6, e: -4 }))).toEqual([
      { fromMemberId: "e", toMemberId: "a", amount: 4 },
      { fromMemberId: "d", toMemberId: "b", amount: 3 },
      { fromMemberId: "d", toMemberId: "c", amount: 3 },
    ]);
  });

  it("금액이 같으면 동행자 목록 순서가 앞인 사람부터 맞춘다", () => {
    expect(
      settleBalances(balances({ me: 5_000, minjun: 5_000, seoyeon: -10_000 })),
    ).toEqual([
      { fromMemberId: "seoyeon", toMemberId: "me", amount: 5_000 },
      { fromMemberId: "seoyeon", toMemberId: "minjun", amount: 5_000 },
    ]);
  });

  it("차액이 모두 0이면 보낼 것이 없다", () => {
    expect(settleBalances(balances({ me: 0, minjun: 0 }))).toEqual([]);
    expect(settleBalances([])).toEqual([]);
  });

  it("16명 이상이면 묶음 없이 정산하고 최대 (사람 수 − 1)번 보낸다", () => {
    const input = [
      ...Array.from({ length: 8 }, (_, index) => ({
        memberId: `c${index}`,
        balance: index + 1,
      })),
      ...[-4, -5, -4, -5, -4, -5, -4, -5].map((balance, index) => ({
        memberId: `d${index}`,
        balance,
      })),
    ];
    const transfers = settleBalances(input);

    expect(transfers.length).toBeLessThanOrEqual(input.length - 1);
    expect(applyTransfers(input, transfers).every((balance) => balance === 0)).toBe(
      true,
    );
  });

  it("합이 0이 아니거나 정수가 아니면 거부한다", () => {
    expect(() => settleBalances(balances({ me: 1, minjun: 0 }))).toThrow(RangeError);
    expect(() => settleBalances(balances({ me: 0.5, minjun: -0.5 }))).toThrow(
      RangeError,
    );
  });
});
