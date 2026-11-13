export function formatCountdown(target: string | Date, now: Date): string {
  const targetTime = typeof target === "string" ? new Date(target) : target;
  const remainingSeconds = Math.max(
    0,
    Math.floor((targetTime.getTime() - now.getTime()) / 1_000),
  );

  if (remainingSeconds >= 86_400) {
    const days = Math.floor(remainingSeconds / 86_400);
    const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
    return hours === 0 ? `${days}일` : `${days}일 ${hours}시간`;
  }

  if (remainingSeconds >= 3_600) {
    const hours = Math.floor(remainingSeconds / 3_600);
    const minutes = Math.floor((remainingSeconds % 3_600) / 60);
    return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
