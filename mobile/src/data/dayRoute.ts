import { distanceMeters, type GeoPoint } from "./photoDays";
export function reconcileOrder(saved: string[], ids: string[]): string[] {
  return [...new Set([...saved.filter((id) => ids.includes(id)), ...ids])];
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= items.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
// 첫 장소(또는 숙소)에서 매번 가장 가까운 곳을 고른다. 최단 경로 보장은 하지 않는다.
export function nearestOrder<T extends GeoPoint & { id: string }>(
  points: T[],
  lodging?: GeoPoint,
): string[] {
  const left = [...points];
  const ids: string[] = [];
  let cursor = lodging ?? left[0];
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++)
      if (distanceMeters(cursor, left[i]) < distanceMeters(cursor, left[best]))
        best = i;
    const [next] = left.splice(best, 1);
    ids.push(next.id);
    cursor = next;
  }
  return ids;
}
