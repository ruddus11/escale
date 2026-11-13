import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";
import { KeyedError } from "../i18n/errors";
import { fetchWithTimeout } from "./fetchWithTimeout";

export type LoginProvider = "apple" | "kakao" | "google";
export type LoginMethod = LoginProvider | "email";

// 화면에 보일 로그인 방법. 제공자 설정을 마친 것만 켠다. 예: "apple,email,kakao"
export const loginMethods: LoginMethod[] = parseLoginMethods(process.env.EXPO_PUBLIC_LOGIN_METHODS);

export function parseLoginMethods(raw: string | undefined): LoginMethod[] {
  const all: LoginMethod[] = ["apple", "kakao", "google", "email"];
  const picked = (raw ?? "apple,email").split(",").map((v) => v.trim()).filter((v): v is LoginMethod => all.includes(v as LoginMethod));
  return all.filter((m) => picked.includes(m));
}

/** 앞뒤 공백을 지우고 소문자로 바꾼 이메일. 형식이 틀리면 null. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

/** 로그인 오류. 사전 키를 들고 다니고 화면이 언어에 맞춰 번역한다. */
export class AuthError extends KeyedError {}

/** 사용자가 로그인 창을 닫은 경우. 오류 안내 없이 조용히 끝낸다. */
export class AuthCanceled extends Error {}

// 카카오·구글 로그인 뒤 앱으로 돌아오는 주소. Supabase의 Redirect URLs에 같은 값을 등록한다.
// 앱은 margin과 travelpouch scheme을 모두 받는다. Supabase에 margin://auth-callback을 등록하기 전에는 바꾸지 않는다.
export const AUTH_REDIRECT = "travelpouch://auth-callback";
const AUTH_CALLBACKS = [AUTH_REDIRECT, "margin://auth-callback"];

function client() {
  if (!supabase) throw new AuthError("auth.notConfigured");
  return supabase;
}

export async function signIn(provider: LoginProvider) {
  if (provider === "apple" && Platform.OS === "ios") return signInWithApple();
  return signInWithBrowser(provider);
}

// Apple은 기기 기본 로그인 창을 쓴다. nonce 원문은 Supabase에, SHA-256 해시는 Apple에 보내
// 가로챈 토큰을 다른 로그인에 다시 쓰지 못하게 한다.
async function signInWithApple() {
  const auth = client();
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") throw new AuthCanceled();
    throw new AuthError("auth.appleFailed");
  }
  if (!credential.identityToken) throw new AuthError("auth.appleNoToken");
  const { error } = await auth.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
  if (error) throw new AuthError("auth.appleCheck");
}

// 카카오·구글은 로그인 페이지를 앱 안 브라우저로 열고, 돌아온 주소의 code를 세션으로 바꾼다.
async function signInWithBrowser(provider: "apple" | "kakao" | "google") {
  const auth = client();
  const { data, error } = await auth.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new AuthError("auth.pageFailed");
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type !== "success") throw new AuthCanceled();
  const code = authCodeFrom(result.url);
  if (!code) throw new AuthError("auth.canceled");
  const exchanged = await auth.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw new AuthError("auth.checkFailed");
}

/** 메일 링크로 앱이 열렸을 때 로그인을 마친다. 우리 주소가 아니거나 code가 없으면 false. */
export async function completeSignInFromUrl(url: string): Promise<boolean> {
  if (!supabase || !AUTH_CALLBACKS.some((callback) => url.startsWith(`${callback}?`) || url.startsWith(`${callback}#`))) return false;
  const code = authCodeFrom(url);
  if (!code) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  // 링크는 코드를 요청한 그 기기에서 눌러야 한다(PKCE 검증값이 그 기기에만 있다).
  if (error) throw new AuthError("auth.linkInvalid");
  return true;
}

/** 돌아온 주소에서 code를 꺼낸다. 오류로 돌아왔으면 null. */
export function authCodeFrom(returnUrl: string): string | null {
  const query = returnUrl.split("#")[0].split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  if (params.get("error")) return null;
  return params.get("code");
}

// 이메일 로그인은 메일로 받은 숫자 코드를 앱에 입력하는 방식이다(링크 방식은 앱으로 돌아오기 번거롭다).
// Supabase 메일 템플릿에 {{ .Token }}이 들어 있어야 코드가 메일에 보인다.
export async function sendEmailCode(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new AuthError("auth.checkEmail");
  // 메일 문구는 SMTP를 연결해야 고칠 수 있어서, 기본 메일의 "Sign in" 링크로도 앱에 돌아오게 한다.
  const { error } = await client().auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT } });
  if (error) {
    throw new AuthError(
      error.status === 429 ? "auth.tooMany" : "auth.sendFailed",
    );
  }
  return email;
}

export async function verifyEmailCode(email: string, rawCode: string) {
  const token = rawCode.replace(/\D/g, "");
  if (token.length < 6) throw new AuthError("auth.codeIncomplete");
  const { error } = await client().auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new AuthError("auth.codeWrong");
}

export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

// 계정 삭제는 서버(service role)에서만 할 수 있다. 성공하면 이 기기의 로그인도 지운다.
export async function deleteAccount(baseUrl: string, accessToken: string, fetchImpl: typeof fetch = fetch) {
  if (!baseUrl) throw new AuthError("auth.noServer");
  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/api/delete-account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }, { fetchImpl, timeoutMs: 30_000 });
  } catch {
    // 제한 시간이 지나도 연결 안내로 끝낸다. 서버에서는 지워졌을 수 있어 로그인은 그대로 두고 다시 시도하게 한다.
    throw new AuthError("auth.offline");
  }
  if (!response.ok) throw new AuthError("auth.deleteFailed");
  await client().auth.signOut({ scope: "local" });
}
