import { redactConfirmation } from "../../../src/domain/reservations/confirmation";
import { MAX_POUCH_ITEMS, MAX_POUCH_TEXT, isPouchJudgment, type PouchJudgment } from "../../../src/domain/pouch/judgment";
import type { Key } from "../i18n/strings";
import { KeyedError } from "../i18n/errors";
import { limitKey } from "./usageLimit";
import { fetchWithTimeout, isFetchTimeout } from "./fetchWithTimeout";

const messages: Record<number, Key> = {
  400: "import.tooLong",
  401: "import.badCode",
  402: "import.notPaid",
  503: "import.serverSetup",
  504: "import.slow",
};

/** 기기에서 읽지 못한 한 줄을 서버의 Jev에게 물어본다(유료). 보내기 전에 기기에서도 예약번호·연락처를 가린다. */
export async function requestPouchJudgment({
  baseUrl,
  accessCode,
  text,
  items,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  accessCode: string;
  text: string;
  items: { id: string; title: string }[];
  fetchImpl?: typeof fetch;
}): Promise<PouchJudgment> {
  const line = redactConfirmation(text.trim()).slice(0, MAX_POUCH_TEXT);
  if (!line) throw new KeyedError("import.tooLong");
  if (!baseUrl) throw new KeyedError("auth.noServer");
  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/api/read-pouch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessCode.trim()}` },
      // 아직 안 챙긴 것부터 보내 목록이 길어도 쓸모 있는 쪽이 남게 한다.
      body: JSON.stringify({ text: line, items: items.slice(0, MAX_POUCH_ITEMS).map((i) => ({ id: i.id, title: i.title.slice(0, 120) })) }),
    }, { fetchImpl, timeoutMs: 20_000 });
  } catch (error) {
    throw new KeyedError(isFetchTimeout(error) ? "import.slow" : "auth.offline");
  }
  if (response.status === 429) throw new KeyedError(await limitKey(response));
  if (!response.ok) throw new KeyedError(messages[response.status] ?? "import.failed");
  const body = await response.json().catch(() => null);
  if (!isPouchJudgment(body)) throw new KeyedError("import.failed");
  return body;
}
