import { allMemories } from "./diaryMemoryStore";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { parseNotebook, type NotebookData } from "./model";
import { KeyedError } from "../i18n/errors";
import { translateNow } from "../i18n/I18n";
export async function exportNotebook(data: NotebookData) {
  if (!(await Sharing.isAvailableAsync()))
    throw new KeyedError("backup.noShare");
  const file = new File(Paths.cache, `escale-${Date.now()}.json`);
  try {
    const diaryMemories = await allMemories(data.library.trips.map(t => t.id));
    const json = JSON.stringify({ ...data, diaryMemories }, null, 2);
    parseNotebook(json);
    file.write(json);
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: translateNow("backup.dialog"),
    });
  } finally {
    if (file.exists) file.delete();
  }
}
export async function pickNotebook(): Promise<NotebookData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "public.json"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0],
    file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > 5_000_000)
      throw new KeyedError("backup.pickSmall");
    return parseNotebook(await file.text());
  } finally {
    if (file.exists && file.uri.startsWith(Paths.cache.uri)) file.delete();
  }
}
