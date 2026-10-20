/**
 * Unit test untuk diffBooking & isEmptyDiff (S2-02.2).
 * Fungsi murni, tidak butuh DB.
 */
import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/decimal";
import { diffBooking, isEmptyDiff } from "@/ingest/pipeline/diff";
import type { NormalizedBooking } from "@/adapters/types";
import type { BookingSnapshot } from "@/ingest/pipeline/diff";

function booking(partial: Partial<NormalizedBooking> = {}): NormalizedBooking {
  return {
    channel: "AIRBNB",
    externalId: "HM0001",
    status: "CONFIRMED",
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    nights: 2,
    currency: "IDR",
    grossAmount: "1500000",
    ...partial,
  };
}

function snapshot(partial: Partial<BookingSnapshot> = {}): BookingSnapshot {
  return {
    status: "PENDING",
    checkIn: new Date("2026-10-25T00:00:00Z"),
    checkOut: new Date("2026-10-27T00:00:00Z"),
    nights: 2,
    guestsCount: null,
    currency: "IDR",
    grossAmount: new Decimal("1500000"),
    taxesCollected: new Decimal("0"),
    cancellationFee: new Decimal("0"),
    commissionAmount: null,
    commissionRate: null,
    collectType: "UNKNOWN",
    fxRateToBase: new Decimal("1"),
    ...partial,
  };
}

describe("diffBooking", () => {
  it("mengembalikan diff kosong saat identik", () => {
    const b = booking();
    const s = snapshot({
      status: "CONFIRMED",
      checkIn: "2026-10-25",
      checkOut: "2026-10-27",
      nights: 2,
      guestsCount: null,
      grossAmount: new Decimal("1500000"),
    });
    const diff = diffBooking(s, b);
    expect(isEmptyDiff(diff)).toBe(true);
    expect(diff).toEqual({});
  });

  it("mendeteksi perubahan status", () => {
    const diff = diffBooking(snapshot(), booking({ status: "CONFIRMED" }));
    expect(diff.status).toEqual({ from: "PENDING", to: "CONFIRMED" });
  });

  it("mendeteksi perubahan tanggal (Date vs string konsisten)", () => {
    const diff = diffBooking(
      snapshot({ checkIn: "2026-10-25", checkOut: "2026-10-27" }),
      booking({ checkIn: "2026-10-26", checkOut: "2026-10-28" }),
    );
    expect(diff.checkIn).toEqual({ from: "2026-10-25", to: "2026-10-26" });
    expect(diff.checkOut).toEqual({ from: "2026-10-27", to: "2026-10-28" });
  });

  it("mendeteksi perubahan grossAmount toleran format", () => {
    const diff = diffBooking(
      snapshot({ grossAmount: new Decimal("1500000") }),
      booking({ grossAmount: "1500000.00" }),
    );
    expect(diff.grossAmount).toBeUndefined();
  });

  it("mendeteksi perubahan taxesCollected & commissionAmount", () => {
    const diff = diffBooking(
      snapshot({
        taxesCollected: new Decimal("0"),
        commissionAmount: new Decimal("150000"),
      }),
      booking({
        taxesCollected: "75000",
        commissionAmount: "225000",
      }),
    );
    expect(diff.taxesCollected?.to).toBe("75000");
    expect(diff.commissionAmount?.to).toBe("225000");
    expect(diff.commissionAmount?.from).toBe("150000");
  });

  it("tidak memasukkan field yang event-nya tidak menyertakan nilai", () => {
    const diff = diffBooking(
      snapshot({ guestsCount: 2, collectType: "CHANNEL_COLLECT" }),
      booking(), // guestsCount & collectType tidak di-set
    );
    expect(diff.guestsCount).toBeUndefined();
    expect(diff.collectType).toBeUndefined();
  });

  it("mendeteksi perubahan collectType eksplisit", () => {
    const diff = diffBooking(
      snapshot({ collectType: "UNKNOWN" }),
      booking({ collectType: "CHANNEL_COLLECT" }),
    );
    expect(diff.collectType).toEqual({ from: "UNKNOWN", to: "CHANNEL_COLLECT" });
  });

  it("tidak menyentuh field event absent (grossAmount tidak di-set saat CANCELLED)", () => {
    const s = snapshot({ grossAmount: new Decimal("1500000") });
    const e = booking({ status: "CANCELLED" });
    delete (e as Partial<NormalizedBooking>).grossAmount;
    const diff = diffBooking(s, e);
    expect(diff.grossAmount).toBeUndefined();
    expect(diff.status).toEqual({ from: "PENDING", to: "CANCELLED" });
  });

  it("mendeteksi multi-field diff sekaligus", () => {
    const diff = diffBooking(
      snapshot({
        status: "PENDING",
        checkIn: "2026-10-25",
        checkOut: "2026-10-27",
        grossAmount: new Decimal("1500000"),
        commissionAmount: null,
      }),
      booking({
        status: "CONFIRMED",
        checkIn: "2026-10-26",
        checkOut: "2026-10-28",
        grossAmount: "2000000",
        commissionAmount: "200000",
      }),
    );
    expect(Object.keys(diff).sort()).toEqual(
      ["checkIn", "checkOut", "commissionAmount", "grossAmount", "status"].sort(),
    );
  });
});

describe("isEmptyDiff", () => {
  it("true untuk object kosong", () => {
    expect(isEmptyDiff({})).toBe(true);
  });
  it("false bila ada satu field pun", () => {
    expect(isEmptyDiff({ status: { from: "a", to: "b" } })).toBe(false);
  });
});
