import type { TripWorkspace } from "../../domain/workspace/types";
import type { Reservation } from "../../domain/reservations/types";
import { ReservationManager } from "./ReservationManager";

export function ReservationsScreen({ trip, now, onChange, initialSelected }: { trip: TripWorkspace; now: Date; onChange: (items: Reservation[]) => void; initialSelected?: string }) {
  return <div className="reservations-screen"><header className="reservation-page-heading"><span>{trip.settings.title}</span><h1>예약 수첩</h1><p>숙소 · 이동 · 입장</p></header>
    <ReservationManager items={trip.reservations ?? []} timeZone={trip.settings.timeZone} startDate={trip.settings.startDate} now={now} onChange={onChange} initialSelected={initialSelected} />
    <details className="reservation-privacy"><summary>저장과 개인정보</summary><p>예약 기본정보는 이 브라우저에 저장되며 자동으로 공유되지 않습니다. 암호화 보관함은 아니므로 공용 기기에서는 사용하지 마세요.</p><p>예약번호·QR·여권·출입 비밀번호는 보관하지 않습니다. 자유 입력란에도 넣지 마세요. 브라우저 데이터를 지우면 예약도 지워집니다.</p><p>JSON 백업에는 기본 예약정보가 포함됩니다. 백업은 암호화되지 않으므로 공유하지 마세요.</p></details>
  </div>;
}
