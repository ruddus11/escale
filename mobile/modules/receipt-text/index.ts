import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/** 좌표는 0~1 비율, 왼쪽 위 원점. 이전 빌드의 네이티브 모듈에서는 글자만 온다. */
export type TextBlock = { text: string; x?: number; y?: number; width?: number; height?: number };

// iOS에서만 쓴다. 네이티브 모듈이 없는 환경(안드로이드, 테스트)에서는 null.
const native = Platform.OS === "ios" ? requireOptionalNativeModule<{
  recognize(uri: string): Promise<string[]>;
  recognizeBlocks?(uri: string): Promise<TextBlock[]>;
}>("ReceiptText") : null;

export const canReadReceipts = !!native;

/** 사진 속 글자를 위에서 아래 줄 순서로 돌려준다. */
export async function readReceiptLines(uri: string): Promise<string[]> {
  if (!native) throw new Error("Receipt reading is not available on this device");
  return native.recognize(uri);
}

/** 줄과 위치를 함께 돌려준다. 위치를 못 주는 빌드에서는 줄 순서만 쓴다. */
export async function readReceiptBlocks(uri: string): Promise<TextBlock[]> {
  if (!native) throw new Error("Receipt reading is not available on this device");
  if (typeof native.recognizeBlocks === "function") return native.recognizeBlocks(uri);
  return (await native.recognize(uri)).map(text => ({ text }));
}
