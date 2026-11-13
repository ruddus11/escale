/**
 * 합계가 어긋나지 않도록, 비율대로 나눈 뒤 남은 단위를 소수 부분이 큰 쪽부터 배분한다.
 * 예: 10원을 3명이 균등 분담하면 [4, 3, 3]. 소수 부분이 같으면 앞 순서가 먼저다.
 */
export function allocateByWeights(
  total: number,
  weights: readonly number[],
): number[] {
  if (!isNonNegativeSafeInteger(total) || !weights.every(isNonNegativeSafeInteger)) {
    throw new RangeError("Allocation needs non-negative safe integers");
  }
  const weightSum = weights.reduce((sum, weight) => sum + BigInt(weight), 0n);
  if (weightSum === 0n) {
    throw new RangeError("Allocation needs at least one positive weight");
  }

  const bigTotal = BigInt(total);
  const parts = weights.map((weight, index) => {
    const scaled = bigTotal * BigInt(weight);
    return { index, floor: scaled / weightSum, remainder: scaled % weightSum };
  });
  let leftover = bigTotal - parts.reduce((sum, part) => sum + part.floor, 0n);
  const byRemainder = [...parts].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });

  const result = parts.map((part) => part.floor);
  for (const part of byRemainder) {
    if (leftover === 0n) break;
    result[part.index] += 1n;
    leftover -= 1n;
  }
  return result.map(Number);
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
