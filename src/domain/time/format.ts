import { deviceTimeZone, zonedTime } from "./zoned";

export function formatTime(instant: string | Date, timeZone = deviceTimeZone()): string {
  return zonedTime(instant, timeZone);
}
