import type { Reservation } from "../../../src/domain/reservations/types";
import type { Key } from "../i18n/strings";

type EditingPanel = { kind: string; from?: "overview" } | null;

/** 저장이 끝난 뒤에만 부른다. 개요에서 시작한 입력은 개요로, 나머지는 저장한 예약 상세로 간다. */
export function afterReservationSave(panel: EditingPanel, saved: Reservation): { panel: { kind: "reservation"; item: Reservation } | null; note: Key | null } {
  if (panel?.kind === "reservation-edit" && panel.from === "overview") return { panel: null, note: "res.savedToNotebook" };
  return { panel: { kind: "reservation", item: saved }, note: null };
}
