import { useState } from "react";
import type { Reservation } from "../../domain/reservations/types";
import { isReservationList, reservationKinds } from "../../domain/reservations/reservations";
import { ReservationEditor } from "./ReservationEditor";
import { ReservationList } from "./ReservationList";
import { ReservationDetail } from "./ReservationDetail";

interface Props {
  items: Reservation[];
  timeZone: string;
  startDate: string;
  now: Date;
  onChange: (items: Reservation[]) => void;
  onEditingChange?: (editing: boolean) => void;
  initialSelected?: string;
}

export function ReservationManager({ items, timeZone, startDate, now, onChange, onEditingChange, initialSelected }: Props) {
  const [draft, setDraft] = useState<Reservation | null>(null);
  const [selectedId, setSelectedId] = useState(initialSelected);
  const [status, setStatus] = useState("");
  const selected = items.find(r => r.id === selectedId);
  function edit(item: Reservation) { setDraft(item); onEditingChange?.(true); setStatus(""); }
  function closeEditor() { setDraft(null); onEditingChange?.(false); }
  function save(item: Reservation) {
    const existing = items.some(r => r.id === item.id);
    const next = existing ? items.map(r => r.id === item.id ? item : r) : [...items, item];
    if (!isReservationList(next)) { setStatus("예약 내용을 확인해 주세요."); return; }
    onChange(next); closeEditor(); setSelectedId(undefined); setStatus(`${item.title} 예약을 반영했어요.`);
  }
  if (draft) return <ReservationEditor key={draft.id} initial={draft} now={now} onSave={save} onCancel={closeEditor} />;
  if (selected) return <ReservationDetail item={selected} now={now} onBack={() => setSelectedId(undefined)} onEdit={() => edit(selected)} onVerify={() => onChange(items.map(r => r.id === selected.id ? { ...r, verifiedAt: now.toISOString() } : r))} onRemove={() => { onChange(items.filter(r => r.id !== selected.id)); setSelectedId(undefined); setStatus("예약을 지웠어요."); }} />;
  return <section aria-label="저장한 예약">
    <div className="reservation-section-heading"><span>{items.length ? `${items.length}개의 예약` : "아직 예약이 없어도 괜찮아요"}</span><small>현지 시각 기준</small></div>
    {items.length ? <ReservationList items={items} onOpen={setSelectedId} /> : <p className="reservation-empty">숙소와 이동편을 적어두면<br />여행 첫 장에서 꺼내 볼 수 있어요.</p>}
    <div className="reservation-add-options" aria-label="예약 추가">{Object.entries(reservationKinds).map(([kind, label]) => <button disabled={items.length >= 100} key={kind} type="button" onClick={() => edit({ id: crypto.randomUUID(), kind: kind as Reservation["kind"], title: "", startDate, timeZone, updatedAt: now.toISOString() })}>＋ {label}</button>)}</div>
    {items.length >= 100 ? <p>수첩 한 권에는 예약을 100개까지 담을 수 있어요.</p> : null}
    <p className="reservation-caption" role="status">{status}</p>
  </section>;
}
