const ACCESS_TOKEN_KEY = "osaka-pocket.transit-access-token";

export function readAccessToken(): string | null {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return token === null || token.length === 0 ? null : token;
}

export function saveAccessToken(accessToken: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}
