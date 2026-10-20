/**
 * Unit test untuk booking-form-schema.ts (S2-04.2).
 */
import { describe, expect, it } from "vitest";
import { bookingFormSchema, toFieldErrors } from "@/lib/forms/booking-form-schema";

function raw(partial: Record<string, string | undefined> = {}) {
  return {
    externalId: "MAN-2026-001",
    listingId: "L1",
    status: "CONFIRMED",
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    currency: "IDR",
    grossAmount: "1500000",
    cancellationFee: undefined,
    commissionRate: undefined,
    commissionAmount: undefined,
    guestsCount: undefined,
    guestName: undefined,
    collectType: "UNKNOWN" as const,
    bookedOn: undefined,
    ...partial,
  };
}

describe("bookingFormSchema - kasus valid", () => {
  it("menerima form minimal yang lengkap", () => {
    const r = bookingFormSchema.safeParse(raw());
    expect(r.success).toBe(true);
  });

  it("mengubah currency menjadi upper-case", () => {
    const r = bookingFormSchema.safeParse(raw({ currency: "idr" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.currency).toBe("IDR");
  });

  it("string kosong menjadi undefined untuk field opsional", () => {
    const r = bookingFormSchema.safeParse(
      raw({ guestName: "", commissionRate: "", cancellationFee: "" }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.guestName).toBeUndefined();
      expect(r.data.commissionRate).toBeUndefined();
      expect(r.data.cancellationFee).toBeUndefined();
    }
  });

  it("menerima collectType HOTEL_COLLECT", () => {
    const r = bookingFormSchema.safeParse(raw({ collectType: "HOTEL_COLLECT" }));
    expect(r.success).toBe(true);
  });

  it("menerima pemisah ribuan pada grossAmount", () => {
    const r = bookingFormSchema.safeParse(raw({ grossAmount: "1.500.000" }));
    expect(r.success).toBe(true);
  });

  it("menerima guestsCount sebagai string angka dari form", () => {
    const r = bookingFormSchema.safeParse(raw({ guestsCount: "3" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.guestsCount).toBe(3);
  });
});

describe("bookingFormSchema - kasus invalid", () => {
  it("menolak externalId kosong", () => {
    const r = bookingFormSchema.safeParse(raw({ externalId: "   " }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("externalId");
  });

  it("menolak listingId kosong", () => {
    const r = bookingFormSchema.safeParse(raw({ listingId: "" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("listingId");
  });

  it("menolak status di luar enum", () => {
    const r = bookingFormSchema.safeParse(raw({ status: "CANCELLED" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("status");
  });

  it("menolak checkOut <= checkIn", () => {
    const r = bookingFormSchema.safeParse(raw({ checkIn: "2026-10-27", checkOut: "2026-10-25" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("checkOut");
  });

  it("menolak checkOut == checkIn", () => {
    const r = bookingFormSchema.safeParse(raw({ checkIn: "2026-10-25", checkOut: "2026-10-25" }));
    expect(r.success).toBe(false);
  });

  it("menolak tanggal berformat non-ISO", () => {
    const r = bookingFormSchema.safeParse(raw({ checkIn: "25/10/2026" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("checkIn");
  });

  it("menolak grossAmount kosong", () => {
    const r = bookingFormSchema.safeParse(raw({ grossAmount: "" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("grossAmount");
  });

  it("menolak grossAmount dengan huruf", () => {
    const r = bookingFormSchema.safeParse(raw({ grossAmount: "abc" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("grossAmount");
  });

  it("menolak currency bukan 3 huruf", () => {
    const r = bookingFormSchema.safeParse(raw({ currency: "ID" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("currency");
  });

  it("menolak guestsCount bukan bilangan bulat positif", () => {
    const r = bookingFormSchema.safeParse(raw({ guestsCount: "2.5" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("guestsCount");
  });

  it("menolak bookedOn tidak valid", () => {
    const r = bookingFormSchema.safeParse(raw({ bookedOn: "01-10-2026" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r)).toHaveProperty("bookedOn");
  });

  it("menggabungkan beberapa error sekaligus", () => {
    const r = bookingFormSchema.safeParse(raw({ externalId: "", listingId: "" }));
    expect(r.success).toBe(false);
    const errs = toFieldErrors(r);
    expect(Object.keys(errs)).toEqual(expect.arrayContaining(["externalId", "listingId"]));
  });
});

describe("toFieldErrors", () => {
  it("object kosong untuk hasil sukses", () => {
    const r = bookingFormSchema.safeParse(raw());
    expect(toFieldErrors(r)).toEqual({});
  });

  it("mengelompokkan issue per field path", () => {
    const r = bookingFormSchema.safeParse(raw({ externalId: "", listingId: "" }));
    const errs = toFieldErrors(r);
    expect(errs.externalId).toHaveLength(1);
    expect(typeof errs.externalId?.[0]).toBe("string");
  });
});
