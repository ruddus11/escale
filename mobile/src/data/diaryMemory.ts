export { passportStats } from "./passportStats";
import { isDateOnly } from "../../../src/repositories/schemaGuards";
export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}
export interface VoiceNote {
  file: string;
  seconds: number;
}
export interface DiaryMemory {
  tripId: string;
  date: string;
  voices: VoiceNote[];
  route: RoutePoint[];
  steps?: number;
}
export const emptyMemory = (tripId: string, date: string): DiaryMemory => ({
  tripId,
  date,
  voices: [],
  route: [],
});
export function validPoint(p: RoutePoint): boolean {
  return (
    !!p &&
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180 &&
    Number.isFinite(p.timestamp) &&
    p.timestamp > 0
  );
}
export function isDiaryMemory(value: unknown): value is DiaryMemory {
  if (!value || typeof value !== "object") return false;
  const v = value as DiaryMemory;
  return (
    typeof v.tripId === "string" &&
    !!v.tripId &&
    v.tripId.length <= 120 &&
    isDateOnly(v.date) &&
    Array.isArray(v.voices) &&
    v.voices.length <= 50 &&
    v.voices.every(
      (n) =>
        n &&
        /^voice-[a-zA-Z0-9-]+\.m4a$/.test(n.file) &&
        Number.isFinite(n.seconds) &&
        n.seconds >= 0 &&
        n.seconds <= 86400,
    ) &&
    Array.isArray(v.route) &&
    v.route.length <= 10000 &&
    v.route.every(validPoint) &&
    (v.steps === undefined || (Number.isSafeInteger(v.steps) && v.steps >= 0))
  );
}
