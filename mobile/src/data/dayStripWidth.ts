// 날짜 밑줄 탭 한 칸의 너비. 일주일 여행이 폰 한 줄에 다 들어가게 하고,
// 다 안 들어가면 마지막 칸을 반쯤 걸쳐 보여 옆으로 넘길 수 있다는 것을 알린다.
const USUAL = 64;

export function dayStripWidth({ available, count, gap, min }: { available: number; count: number; gap: number; min: number }) {
  if (available <= 0 || count <= 0) return Math.max(USUAL, min);
  if (count * min + (count - 1) * gap <= available) return Math.max(min, Math.min(USUAL, (available - (count - 1) * gap) / count));
  // 다 보이는 칸 k개 뒤에 반 칸이 걸치도록: k(w + gap) + w/2 = available.
  const full = Math.max(1, Math.floor((available - min / 2) / (min + gap)));
  return Math.max(min, (available - full * gap) / (full + 0.5));
}
