import type { Reservation } from "../../domain/reservations/types";
import { isCurrentStay, selectQuickReservations } from "../../domain/reservations/reservations";
import { zonedDate } from "../../domain/time/zoned";

export function ReservationQuickView({ items, now, onOpen }: { items: Reservation[]; now: Date; onOpen: (id?: string) => void }) {
  const quick = selectQuickReservations(items, now);
  return <section className="reservation-quick" aria-label="예약 바로보기"><header className="reservation-section-heading"><h2>꺼내둔 예약</h2><button type="button" onClick={() => onOpen()}>전체 예약 {items.length} ↗</button></header>
    {quick.length ? quick.map(item => <button className="reservation-quick-row" key={item.id} type="button" onClick={() => onOpen(item.id)} aria-label={`${item.title} 예약 바로보기`}><span>{isCurrentStay(item, now) ? "머무는 곳" : item.startDate === zonedDate(now, item.timeZone) ? "오늘 예약" : item.startDate.slice(5).replace("-", ".")}</span><span><strong>{item.title}</strong><small>{item.kind === "stay" ? `${item.startDate.slice(5)} — ${item.endDate?.slice(5) ?? "퇴실일 미정"}` : `${item.startTime ?? "시각 미정"} · ${item.timeZone}`}</small></span><span aria-hidden="true">↗</span></button>) : <button className="reservation-quick-empty" type="button" onClick={() => onOpen()}>{items.length ? "지난 예약 펼쳐보기" : "＋ 숙소와 이동편 적어두기"}</button>}
  </section>;
}
