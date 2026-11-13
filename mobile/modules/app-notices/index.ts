import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

// iOS에서만 쓴다. 네이티브 모듈이 없는 빌드(예전 빌드, 안드로이드, 테스트)에서는 null.
const native = Platform.OS === "ios" ? requireOptionalNativeModule<{ googleMapsNotices(): Promise<string | null> }>("AppNotices") : null;

/** Google 지도 SDK의 오픈소스 고지문. 지도 SDK가 없는 빌드면 null. */
export async function googleMapsNotices(): Promise<string | null> {
  return native ? native.googleMapsNotices() : null;
}

export const canReadNativeNotices = !!native;
