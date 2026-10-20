/**
 * Unit test untuk ManualBookingAdapter (S2-04.1).
 * Menemph pipeline parsing deterministik: input form -> NormalizedBooking.
 */
import { describe, expect, it } from "vitest";
import {
  MANUAL_ADAPTER_ID,
  ManualBookingAdapter,
  normalizeManualInput,
  type ManualBookingInput,
} from "@/adapters/manual";

function formInput(partial: Partial<ManualBookingInput> = {}): ManualBookingInput {
  return {
    externalId: "MAN-2026-001",
    listingId: "L1",
    status: "CONFIRMED",
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    currency: "IDR",
    grossAmount: "1500000",
    ...partial,
  };
}

const adapter = new ManualBookingAdapter();

describe("ManualBookingAdapter kontrak", () => {
  it("id persis 'manual.form.v1'", () => {
    expect(adapter.id).toBe(MANUAL_ADAPTER_ID);
    expect(adapter.id).toBe("manual.form.v1");
  });

  it("channel MANUAL", () => {
    expect(adapter.channel).toBe("MANUAL");
  });

  it("supports() hanya menerima kind 'manual'", () => {
    expect(adapter.supports({ kind: "manual", payload: {} })).toBe(true);
    expect(adapter.supports({ kind: "csv", filename: "a.csv", content: "" })).toBe(false);
    expect(adapter.supports({ kind: "ical", listingId: "L", content: "" })).toBe(false);
  });

  it("parse() menolak input non-manual dengan UNSUPPORTED_FORMAT", () => {
    const res = adapter.parse({ kind: "csv", filename: "a.csv", content: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("UNSUPPORTED_FORMAT");
  });

  it("parse() menolak payload kosong dengan MISSING_FIELD", () => {
    const res = adapter.parse({ kind: "manual", payload: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("MISSING_FIELD");
  });
});

describe("normalizeManualInput", () => {
  it("menghitung nights otomatis dari checkIn/checkOut", () => {
    expect(normalizeManualInput(formInput()).nights).toBe(2);
  });

  it("menghormati nights eksplisit", () => {
    expect(normalizeManualInput(formInput({ nights: 5 })).nights).toBe(5);
  });

  it("upper-case currency", () => {
    expect(normalizeManualInput(formInput({ currency: "idr" })).currency).toBe("IDR");
  });

  it("membuang pemisah ribuan pada amount", () => {
    expect(normalizeManualInput(formInput({ grossAmount: "1.500.000" })).grossAmount).toBe(
      "1500000",
    );
  });

  it("mengubah commissionRate persen menjadi fraksi", () => {
    expect(normalizeManualInput(formInput({ commissionRate: "15" })).commissionRate).toBe("0.15");
    expect(normalizeManualInput(formInput({ commissionRate: "15%" })).commissionRate).toBe("0.15");
  });

  it("membiarkan commissionRate fraksi apa adanya", () => {
    expect(normalizeManualInput(formInput({ commissionRate: "0.12" })).commissionRate).toBe("0.12");
  });

  it("tidak menyertakan cancellationFee bila kosong", () => {
    expect(normalizeManualInput(formInput()).cancellationFee).toBeUndefined();
  });

  it("menyertakan cancellationFee bila diisi", () => {
    expect(normalizeManualInput(formInput({ cancellationFee: "500000" })).cancellationFee).toBe(
      "500000",
    );
  });

  it("trim externalId dan guestName", () => {
    const b = normalizeManualInput(
      formInput({ externalId: "  MAN-001  ", guestName: "  Budi S  " }),
    );
    expect(b.externalId).toBe("MAN-001");
    expect(b.guestName).toBe("Budi S");
  });

  it("menyimpan listingId & metadata form di rawPayload", () => {
    const b = normalizeManualInput(formInput({ bookedOn: "2026-10-01", bookedAtIsApprox: false }));
    expect(b.rawPayload).toMatchObject({
      source: "manual.form.v1",
      listingId: "L1",
      bookedOn: "2026-10-01",
      bookedAtIsApprox: false,
    });
  });

  it("membuat bookedAt hanya bila tanggal pasti (bukan approx)", () => {
    const approx = normalizeManualInput(formInput({ bookedOn: "2026-10-01" }));
    expect(approx.bookedAt).toBeUndefined();

    const pasti = normalizeManualInput(
      formInput({ bookedOn: "2026-10-01", bookedAtIsApprox: false }),
    );
    expect(pasti.bookedAt).toBeInstanceOf(Date);
    // 2026-10-01T00:00 WITA (UTC+8) = 2026-09-30T16:00Z. toISOString() selalu UTC.
    expect(pasti.bookedAt?.toISOString()).toBe("2026-09-30T16:00:00.000Z");
  });
});

describe("ManualBookingAdapter.parse (sukses)", () => {
  it("menghasilkan satu event CREATED dengan confidence high", () => {
    const res = adapter.parse({ kind: "manual", payload: formInput() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.events).toHaveLength(1);
    expect(res.events[0]?.eventType).toBe("CREATED");
    expect(res.events[0]?.confidence).toBe("high");
    expect(res.events[0]?.warnings).toEqual([]);
    expect(res.events[0]?.booking.channel).toBe("MANUAL");
    expect(res.events[0]?.booking.externalId).toBe("MAN-2026-001");
  });

  it("deterministik untuk input yang sama", () => {
    const a = adapter.parse({ kind: "manual", payload: formInput() });
    const b = adapter.parse({ kind: "manual", payload: formInput() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("menerima status PENDING", () => {
    const res = adapter.parse({ kind: "manual", payload: formInput({ status: "PENDING" }) });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.events[0]?.booking.status).toBe("PENDING");
  });
});

describe("ManualBookingAdapter.parse (validasi gagal)", () => {
  it("menolak externalId kosong", () => {
    const res = adapter.parse({ kind: "manual", payload: formInput({ externalId: "  " }) });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorCode).toBe("INVALID_VALUE");
      expect(res.details).toHaveProperty("externalId");
    }
  });

  it("menolak checkOut <= checkIn", () => {
    const res = adapter.parse({
      kind: "manual",
      payload: formInput({ checkIn: "2026-10-27", checkOut: "2026-10-25" }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.details).toHaveProperty("checkOut");
  });

  it("menolak tanggal tidak valid", () => {
    const res = adapter.parse({ kind: "manual", payload: formInput({ checkIn: "25/10/2026" }) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("INVALID_VALUE");
  });

  it("menolak CONFIRMED tanpa grossAmount", () => {
    const res = adapter.parse({
      kind: "manual",
      payload: { ...formInput(), grossAmount: "" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("INVALID_VALUE");
  });

  it("menolak commissionRate > 1 setelah normalisasi persen", () => {
    // "150" -> 1.5, di luar rentang 0..1
    const res = adapter.parse({
      kind: "manual",
      payload: formInput({ commissionRate: "150" }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.details).toHaveProperty("commissionRate");
  });

  it("mengembalikan pesan error dalam Bahasa Indonesia", () => {
    const res = adapter.parse({ kind: "manual", payload: formInput({ externalId: "" }) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/tidak valid/i);
  });
});
