import { useEffect, useState } from "react";
import { paidBuild } from "./premium";
import { premiumStore } from "./sqlite";
import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

/** 장소 찾기에 쓸 서버 주소와 인증 값. 로그인 토큰이 우선이고, 시험 빌드에서는 접근 코드도 쓴다. */
export function usePlaceAccess() {
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  // 로그인 상태를 읽었는지. 읽기 전에 바로 검색하면 로그인했어도 "로그인 필요"로 끝난다.
  const [ready, setReady] = useState(!supabase);
  // 시험 빌드의 접근 코드도 기기에서 읽은 뒤에야 "로그인 필요"로 판단한다.
  const [codeReady, setCodeReady] = useState(!paidBuild.testTools);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(
      ({ data }) => {
        setToken(data.session?.access_token ?? "");
        setReady(true);
      },
      () => setReady(true),
    );
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setToken(session?.access_token ?? ""));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!paidBuild.testTools) return;
    premiumStore.load().then(
      (p) => {
        setCode(p.accessCode);
        setCodeReady(true);
      },
      () => setCodeReady(true),
    );
  }, []);
  // canSignIn: 로그인(supabase 설정)이나 접근 코드 중 하나라도 받을 수 있는 빌드인지.
  return { baseUrl: API_BASE_URL, credential: token || code, ready: ready && codeReady, canSignIn: !!supabase || paidBuild.testTools };
}
