import { Directory,File,Paths } from "expo-file-system";
import { todayStore } from "./sqlite";
import { isDiaryMemory,type DiaryMemory } from "./diaryMemory";
export const voiceFile = (name: string) =>
  new File(new Directory(Paths.document, "diary-voices"), name);
export const memoryKey = (tripId: string, date: string) =>
  `diary:${tripId}:${date}`;
export async function writeMemory(value: DiaryMemory) {
  if (!isDiaryMemory(value)) throw new Error("기록 형식을 확인해 주세요.");
  await todayStore.set(
    memoryKey(value.tripId, value.date),
    JSON.stringify(value),
  );
}
export async function allMemories(tripIds: string[]) {
  const rows = await todayStore.list(["diary:"]);
  return rows
    .map((r) => JSON.parse(r.value) as unknown)
    .filter(
      (v): v is DiaryMemory => isDiaryMemory(v) && tripIds.includes(v.tripId),
    );
}

export async function deleteTripMemories(tripId: string) {
  const rows = await todayStore.list([`diary:${tripId}:`]);
  for (const row of rows) {
    const value: unknown = JSON.parse(row.value);
    if (isDiaryMemory(value) && value.tripId === tripId) {
      for (const voice of value.voices) {
        const f = voiceFile(voice.file);
        if (f.exists) f.delete();
      }
      await todayStore.remove(row.key);
    }
  }
}
export function clearVoiceFiles() {
  const dir = new Directory(Paths.document, "diary-voices");
  if (dir.exists) dir.delete();
}
