export interface MemberBalance {
  memberId: string;
  /** + 받을 돈, − 보낼 돈 */
  balance: number;
}

export interface SettlementTransfer {
  fromMemberId: string;
  toMemberId: string;
  /** 기준 통화 최소 단위 */
  amount: number;
}

interface Person {
  memberId: string;
  /** 입력 순서. 동점이면 앞 순서가 먼저 */
  order: number;
  balance: number;
}

interface Transfer {
  from: Person;
  to: Person;
  amount: number;
}

// 인원이 늘수록 조합 수가 급증하므로, 최소 송금 횟수 탐색은 15명까지만 한다.
const EXACT_LIMIT = 15;

/**
 * 차액을 송금 목록으로 바꾼다. 입력 순서가 동점 처리 순서다.
 * 차액이 있는 사람이 15명 이하이면 송금 횟수가 최소이고,
 * 그보다 많으면 묶음 없이 계산해 최대 (사람 수 − 1)번이다.
 */
export function settleBalances(
  balances: readonly MemberBalance[],
): SettlementTransfer[] {
  if (!balances.every(({ balance }) => Number.isSafeInteger(balance))) {
    throw new RangeError("Balances must be safe integers");
  }
  if (balances.reduce((sum, { balance }) => sum + balance, 0) !== 0) {
    throw new RangeError("Balances must sum to zero");
  }

  const people = balances
    .map(({ memberId, balance }, order) => ({ memberId, order, balance }))
    .filter((person) => person.balance !== 0);
  const groups =
    people.length <= EXACT_LIMIT ? splitIntoZeroSumGroups(people) : [people];

  return groups
    .flatMap(settleGroup)
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.from.order - right.from.order ||
        left.to.order - right.to.order,
    )
    .map(({ from, to, amount }) => ({
      fromMemberId: from.memberId,
      toMemberId: to.memberId,
      amount,
    }));
}

/**
 * 서로 정산이 끝나는 묶음을 많이 만들수록 송금 횟수가 줄어든다.
 * 예: [+4, -4, +3, -3]은 두 묶음으로 나누면 송금 2번으로 끝난다.
 */
function splitIntoZeroSumGroups(people: readonly Person[]): Person[][] {
  const size = 1 << people.length;
  // mask의 각 비트는 한 사람의 포함 여부다. sums는 선택한 사람들의 차액 합이다.
  const sums = new Float64Array(size);
  // best는 만들 수 있는 0원 묶음 수, lastPick은 묶음 복원에 사용할 마지막 사람이다.
  const best = new Int8Array(size);
  const lastPick = new Int8Array(size);

  for (let mask = 1; mask < size; mask += 1) {
    const lowestBit = mask & -mask;
    sums[mask] = sums[mask ^ lowestBit] + people[31 - Math.clz32(lowestBit)].balance;
    let bestCount = -1;
    for (let index = 0; index < people.length; index += 1) {
      const bit = 1 << index;
      if ((mask & bit) !== 0 && best[mask ^ bit] > bestCount) {
        bestCount = best[mask ^ bit];
        lastPick[mask] = index;
      }
    }
    best[mask] = bestCount + (sums[mask] === 0 ? 1 : 0);
  }

  const groups: Person[][] = [];
  let group: Person[] = [];
  for (let mask = size - 1; mask !== 0; ) {
    const index = lastPick[mask];
    group.push(people[index]);
    mask ^= 1 << index;
    if (sums[mask] === 0) {
      groups.push(group);
      group = [];
    }
  }
  return groups;
}

/** 한 묶음 안에서는 가장 많이 보낼 사람이 가장 많이 받을 사람에게 보낸다. */
function settleGroup(group: readonly Person[]): Transfer[] {
  let debtors = group
    .filter((person) => person.balance < 0)
    .map((person) => ({ person, left: -person.balance }));
  let creditors = group
    .filter((person) => person.balance > 0)
    .map((person) => ({ person, left: person.balance }));
  const transfers: Transfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = largest(debtors);
    const creditor = largest(creditors);
    const amount = Math.min(debtor.left, creditor.left);
    transfers.push({ from: debtor.person, to: creditor.person, amount });
    debtor.left -= amount;
    creditor.left -= amount;
    debtors = debtors.filter((entry) => entry.left > 0);
    creditors = creditors.filter((entry) => entry.left > 0);
  }
  return transfers;
}

function largest<T extends { person: Person; left: number }>(entries: T[]): T {
  return entries.reduce((top, entry) =>
    entry.left > top.left ||
    (entry.left === top.left && entry.person.order < top.person.order)
      ? entry
      : top,
  );
}
