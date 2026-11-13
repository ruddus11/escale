import { redactConfirmation, MAX_CONFIRMATION_LENGTH, type ExtractedReservation } from "../../../src/domain/reservations/confirmation";
import { reservationKinds } from "../../../src/domain/reservations/reservations";
import { isTimeZone } from "../../../src/domain/time/zoned";
import type { Reservation } from "../../../src/domain/reservations/types";
import type { Key } from "../i18n/strings";
import { KeyedError } from "../i18n/errors";
import { limitKey } from "./usageLimit";
import { fetchWithTimeout, isFetchTimeout } from "./fetchWithTimeout";

export class ImportError extends KeyedError {}

const messages: Record<number, Key> = {
  400: "import.tooLong",
  401: "import.badCode",
  402: "import.notPaid",
  503: "import.serverSetup",
  504: "import.slow",
};

/** 예약 확인 메일을 서버로 보내 예약 칸 값을 받는다. 보내기 전에 기기에서 예약번호·연락처를 가린다. */
export async function requestExtraction({
  baseUrl,
  accessCode,
  text,
  year,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  accessCode: string;
  text: string;
  year: number;
  fetchImpl?: typeof fetch;
}): Promise<ExtractedReservation> {
  const redacted = redactConfirmation(text.trim()).slice(0, MAX_CONFIRMATION_LENGTH);
  if (!redacted) throw new ImportError("import.empty");
  if (!baseUrl) throw new ImportError("auth.noServer");
  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/api/extract-reservation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessCode.trim()}` },
      body: JSON.stringify({ text: redacted, year }),
    }, { fetchImpl, timeoutMs: 30_000 });
  } catch (error) {
    throw new ImportError(isFetchTimeout(error) ? "import.slow" : "auth.offline");
  }
  if (response.status === 429) throw new ImportError(await limitKey(response));
  if (!response.ok) throw new ImportError(messages[response.status] ?? "import.failed");
  const body = await response.json().catch(() => null);
  return sanitize(body?.reservation);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 서버 응답에서 형식이 맞는 값만 남긴다. */
export function sanitize(value: unknown): ExtractedReservation {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const text = (key: string, max: number) => (typeof v[key] === "string" && v[key] && (v[key] as string).length <= max ? (v[key] as string) : undefined);
  const out: ExtractedReservation = {
    kind: typeof v.kind === "string" && v.kind in reservationKinds ? (v.kind as Reservation["kind"]) : undefined,
    title: text("title", 120),
    startDate: DATE.test(String(v.startDate)) ? (v.startDate as string) : undefined,
    startTime: TIME.test(String(v.startTime)) ? (v.startTime as string) : undefined,
    endDate: DATE.test(String(v.endDate)) ? (v.endDate as string) : undefined,
    endTime: TIME.test(String(v.endTime)) ? (v.endTime as string) : undefined,
    timeZone: typeof v.timeZone === "string" && isTimeZone(v.timeZone) ? v.timeZone : undefined,
    endTimeZone: typeof v.endTimeZone === "string" && isTimeZone(v.endTimeZone) ? v.endTimeZone : undefined,
    departure: text("departure", 120),
    arrival: text("arrival", 120),
    serviceNumber: text("serviceNumber", 40),
  };
  return Object.fromEntries(Object.entries(out).filter(([, x]) => x !== undefined)) as ExtractedReservation;
}

/** 읽어 온 값으로 입력 칸을 채운다. 비어 있던 값만이 아니라 읽은 값은 덮어쓰고, 사용자가 저장 전에 확인한다. */
export function fillReservation(form: Reservation, extracted: ExtractedReservation): Reservation {
  const next: Reservation = { ...form, ...extracted };
  if (extracted.endTime && !extracted.endDate) next.endDate = next.endDate ?? next.startDate;
  return next;
}

export function filledCount(extracted: ExtractedReservation) {
  return Object.keys(extracted).filter((k) => k !== "title" && k !== "kind").length;
}
