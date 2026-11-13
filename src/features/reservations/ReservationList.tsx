import { reservationKinds, sortedReservations } from "../../domain/reservations/reservations";
import type { Reservation } from "../../domain/reservations/types";

export function ReservationList({ items, onOpen }: { items: Reservation[]; onOpen: (id: string) => void }) {
  return <ol className="reservation-list">{sortedReservations(items).map(item => <li key={item.id}><button type="button" onClick={() => onOpen(item.id)} aria-label={`${item.title} 예약 열기`}>
    <span className="reservation-date"><b>{item.startDate.slice(8)}</b><small>{Number(item.startDate.slice(5, 7))}월</small></span>
    <span className="reservation-row-copy"><small>{reservationKinds[item.kind]} · {item.startTime ?? "시각 미정"}</small><strong>{item.title}</strong><span>{item.serviceNumber || item.departure || item.address || item.timeZone}</span></span><span aria-hidden="true">↗</span>
  </button></li>)}</ol>;
}
