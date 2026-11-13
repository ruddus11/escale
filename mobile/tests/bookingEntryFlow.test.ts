import { describe, expect, it } from "vitest";
import type { Reservation } from "../../src/domain/reservations/types";
import { afterReservationSave } from "../src/data/bookingEntryFlow";

const item = (id: string): Reservation => ({ id, title: id, kind: "stay", startDate: "2027-01-04", timeZone: "Asia/Tokyo", updatedAt: "2026-11-06T00:00:00Z" });

describe("after a booking is saved", () => {
  it("returns to the overview when entry began there", () => {
    expect(afterReservationSave({ kind: "reservation-edit", from: "overview" }, item("a"))).toEqual({ panel: null, note: "res.savedToNotebook" });
  });
  it("opens the saved booking when entry began anywhere else", () => {
    expect(afterReservationSave({ kind: "reservation-edit" }, item("a"))).toEqual({ panel: { kind: "reservation", item: item("a") }, note: null });
  });
  it("opens the first leg for a multi-leg save from the pouch", () => {
    expect(afterReservationSave({ kind: "reservation-edit" }, item("b")).panel).toEqual({ kind: "reservation", item: item("b") });
  });
  it("opens the saved booking when no editor panel is open", () => {
    expect(afterReservationSave(null, item("a")).panel).toEqual({ kind: "reservation", item: item("a") });
  });
});
