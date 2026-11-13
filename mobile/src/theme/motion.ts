// 종이를 다루는 손의 속도(ms). 화면마다 숫자를 새로 고르지 않고 여기서 고른다.
// press: 손끝이 닿는 반응, turn: 사진 뒤집기 반쪽, settle: 붙인 것이 자리 잡는 시간, page: 날짜 한 장 넘김 반쪽, draw: 걸은 길 긋기.
export const duration = { press: 90, turn: 210, settle: 420, page: 150, draw: 900 } as const;

// 3차 베지어 조절점. 화면 쪽에서 Easing.bezier(...curve.out)처럼 쓴다.
export const curve = {
  // 붙이거나 내려놓을 때. 빨리 다가와 천천히 멈춘다.
  out: [0.22, 1, 0.36, 1],
  // 집어 들거나 넘길 때. 천천히 떠나 빨리 사라진다.
  in: [0.5, 0, 0.84, 0.3],
  // 도장을 찍을 때. 종이에 닿고 아주 조금 되튄다.
  stamp: [0.3, 1.35, 0.5, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

// 여러 장이 한꺼번에 나타날 때 한 장씩 늦춘다. 여덟 번째 뒤로는 더 기다리게 하지 않는다.
// 예: step 55 → 0, 55, 110 … 440, 440.
export function stagger(index: number, step = 55): number {
  return Math.min(Math.max(index, 0), 8) * step;
}

/**
 * 손으로 붙인 듯한 기울기(도). 같은 id는 언제나 같은 각도라서 다시 그려도 사진이 흔들리지 않는다.
 * 0도 근처는 피한다. 반듯하면 인쇄한 것처럼 보인다. 예: range 4 → -4 ~ -1.2 또는 1.2 ~ 4.
 */
export function stableTilt(id: string, range = 4): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unit = ((hash >>> 0) % 1000) / 999;
  const size = range * (0.3 + 0.7 * unit);
  return Math.round((((hash >>> 12) & 1) ? size : -size) * 10) / 10;
}

/** 세어 올라가는 숫자의 중간값. progress 0 → 0, 1 → target. 끝에서 느려진다. */
export function countAt(target: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(target * (1 - (1 - p) ** 3));
}

/** 꺾은선 길이. 선을 처음부터 끝까지 그어 나가는 데 쓴다. 예: (0,0)→(3,4)→(3,10) = 11. */
export function pathLength(points: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}
