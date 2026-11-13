import type { VercelApiHandler } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendJson, setSafeResponseHeaders } from "../server/http/guards.js";

const BEARER_PATTERN = /^Bearer ([^\s]+)$/;

export interface AccountAdmin {
  /** 로그인 토큰의 사용자 id. 무효면 null. */
  userIdFor(accessToken: string): Promise<string | null>;
  /** 계정을 지운다. 수첩 백업과 유료 권한은 외래키 cascade로 함께 지워진다. */
  deleteUser(userId: string): Promise<void>;
}

// 앱 안에서 계정을 만들 수 있으면 앱 안에서 지울 수도 있어야 한다(App Store 심사 기준 5.1.1(v)).
// 계정 삭제는 service role이 필요해서 앱이 아니라 서버에서 한다.
export function createDeleteAccountHandler(admin: AccountAdmin | null): VercelApiHandler {
  return async (request, response) => {
    setSafeResponseHeaders(response);
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, "METHOD_NOT_ALLOWED");
      return;
    }
    if (!admin) {
      sendJson(response, 503, "SERVER_CONFIG_ERROR");
      return;
    }
    const header = request.headers.authorization;
    const token = typeof header === "string" ? BEARER_PATTERN.exec(header)?.[1] : undefined;
    const userId = token ? await admin.userIdFor(token).catch(() => null) : null;
    if (!userId) {
      sendJson(response, 401, "UNAUTHORIZED");
      return;
    }
    try {
      await admin.deleteUser(userId);
      response.status(200).json({ deleted: true });
    } catch {
      sendJson(response, 502, "UPSTREAM_PROVIDER_ERROR");
    }
  };
}

function supabaseAccountAdmin(): AccountAdmin | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async userIdFor(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      return error || !data.user ? null : data.user.id;
    },
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  };
}

export default createDeleteAccountHandler(supabaseAccountAdmin());
