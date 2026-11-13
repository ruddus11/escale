import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Storage from "expo-sqlite/kv-store";
import * as ExpoCrypto from "expo-crypto";

// Hermes에는 WebCrypto가 없어 Supabase가 PKCE 검증값을 해시 없이(plain) 보내고 난수도 약하게 만든다.
// 로그인에 필요한 두 함수만 expo-crypto(기기 보안 난수·SHA-256)로 채운다.
const g = globalThis as { crypto?: Partial<Crypto> };
if (!g.crypto?.subtle) {
  g.crypto = {
    ...g.crypto,
    getRandomValues: g.crypto?.getRandomValues ?? (ExpoCrypto.getRandomValues as Crypto["getRandomValues"]),
    subtle: {
      digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        if (algorithm !== "SHA-256") throw new Error("Only SHA-256 is available");
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      },
    } as SubtleCrypto,
  };
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
// 공개 키(anon/publishable)만 앱에 둔다. 표 접근은 RLS가 사용자 본인 행으로 제한한다.
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** 설정이 없으면 null. 로그인 없이도 앱의 다른 기능은 그대로 쓴다. */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          // 로그인 세션은 기기 안 SQLite 키-값 저장소에 둔다. 수첩 표와는 다른 파일이다.
          storage: Storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          // 카카오·구글 브라우저 로그인은 코드 교환(PKCE)으로 받아 토큰이 주소창에 남지 않게 한다.
          flowType: "pkce",
        },
      })
    : null;

// 앱이 백그라운드일 때는 토큰 자동 갱신을 멈춘다(Supabase React Native 권장 방식).
if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
