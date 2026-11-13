import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { CurrencyCode } from "../../../src/domain/money/types";
import { canReadReceipts, readReceiptLines } from "../../modules/receipt-text";
import { parseReceipt } from "../data/receipt";
import { useI18n } from "../i18n/I18n";
import type { ExpenseDraft } from "../screens/ExpenseEditor";

/**
 * 영수증 사진 → 기기 안 글자 읽기 → 금액·통화 초안. 초안은 지출 편집 화면에서 확인한 뒤 저장한다.
 * 읽지 못하면 직접 적도록 알린다. 글자 읽기를 못 하는 기기에서는 available이 false다.
 */
export function useReceipt(localCurrency: CurrencyCode, onDraft: (draft: ExpenseDraft) => void, fallbackTitle: (draft: ExpenseDraft) => string) {
  const { t } = useI18n();
  const [reading, setReading] = useState(false);
  async function pick(source: "camera" | "library") {
    // 앨범은 iOS 사진 선택기가 고른 사진만 넘겨줘서 권한을 묻지 않는다. 카메라만 묻는다.
    let uri: string | undefined;
    try {
      if (source === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return Alert.alert(t("receipt.denied"));
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9, exif: false };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      uri = result.canceled ? undefined : result.assets[0]?.uri;
    } catch {
      return Alert.alert(t("receipt.unavailable"));
    }
    if (!uri) return;
    setReading(true);
    try {
      const draft = parseReceipt(await readReceiptLines(uri), localCurrency);
      if (!draft) return Alert.alert(t("receipt.failed"));
      onDraft({ ...draft, title: draft.title || fallbackTitle(draft) });
    } catch {
      Alert.alert(t("receipt.failed"));
    } finally {
      setReading(false);
    }
  }
  function start() {
    if (reading) return;
    Alert.alert(t("receipt.title"), t("receipt.body"), [
      { text: t("receipt.camera"), onPress: () => void pick("camera") },
      { text: t("receipt.library"), onPress: () => void pick("library") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }
  return { available: canReadReceipts, reading, start };
}
