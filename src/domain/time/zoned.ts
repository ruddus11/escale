/** 기기 설정을 기본값으로 쓰되 저장한 여행 시간대가 항상 우선한다. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64 || !value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function localDateTime(value: Date | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (key: string) => parts.find(part => part.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

export function zonedDate(value: Date | string, timeZone: string): string {
  return localDateTime(value, timeZone).slice(0, 10);
}

export function zonedTime(value: Date | string, timeZone: string): string {
  return localDateTime(value, timeZone).slice(11, 16);
}

export function zonedIso(value: Date | string, timeZone: string): string {
  const date = new Date(value);
  const local = localDateTime(date, timeZone);
  const instantSeconds = Math.floor(date.getTime() / 1000) * 1000;
  const offset = Math.round((Date.parse(local + "Z") - instantSeconds) / 60000);
  const sign = offset < 0 ? "-" : "+";
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  const milliseconds = date.getUTCMilliseconds() === 0 ? "" : date.toISOString().slice(19, 23);
  return `${local}${milliseconds}${sign}${hours}:${minutes}`;
}

/** DST의 없는 시각·중복 시각을 임의 보정하지 않고 사용자가 시각을 다시 고르게 한다. */
export function fromLocal(date: string, time: string, timeZone: string): string {
  if (!isTimeZone(timeZone) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new RangeError("Invalid local date/time");
  }
  const target = `${date}T${time}:00`;
  const naive = Date.parse(target + "Z");
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 19) !== target) {
    throw new RangeError("Invalid calendar date");
  }

  // 전환 전후의 오프셋을 모두 후보로 삼아 실제 현지 시각과 역으로 대조한다.
  const offsets = new Set<number>();
  for (const hours of [-48, -24, 0, 24, 48]) {
    const sample = naive + hours * 3_600_000;
    offsets.add(Date.parse(localDateTime(new Date(sample), timeZone) + "Z") - sample);
  }
  const matches = [...offsets]
    .map(offset => new Date(naive - offset))
    .filter(value => localDateTime(value, timeZone) === target);
  if (matches.length !== 1) {
    throw new RangeError("현지 시간 변경으로 없거나 두 번 나타나는 시각입니다. 다른 시각을 선택해 주세요.");
  }
  return zonedIso(matches[0]!, timeZone);
}
