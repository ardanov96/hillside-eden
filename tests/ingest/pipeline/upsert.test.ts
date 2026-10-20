/**
 * Unit test untuk helper murni upsert (S2-02.5): inferBookingFields &
 * computeAllocation. Bagian yang butuh DB akan diuji terpisah.
 */
import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/decimal";
import { computeAllocation, inferBookingFields } from "@/ingest/pipeline/upsert";
import type { NormalizedBooking } from "@/adapters/types";

function nb(partial: Partial<NormalizedBooking> = {}): NormalizedBooking {
  return {
    channel: "AIRBNB",
    externalId: "HM0001",
    status: "CONFIRMED",
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    currency: "IDR",
    grossAmount: "1500000",
    ...partial,
  };
}

describe("inferBookingFields", () => {
  it("menghitung nights dari selisih tanggal bila tidak diberikan", () => {
    const f = inferBookingFields(nb({ nights: undefined }));
    expect(f.nights).toBe(2);
  });

  it("menghormati nights eksplisit dari adapter", () => {
    expect(inferBookingFields(nb({ nights: 5 })).nights).toBe(5);
  });

  it("default guestsCount = 1", () => {
    expect(inferBookingFields(nb()).guestsCount).toBe(1);
  });

  it("default amount wajib = 0 bila tidak ada (booking pembatalan)", () => {
    const e = nb({ status: "CANCELLED" });
    delete (e as Partial<NormalizedBooking>).grossAmount;
    const f = inferBookingFields(e);
    expect(f.grossAmount.equals(new Decimal(0))).toBe(true);
    expect(f.taxesCollected.equals(new Decimal(0))).toBe(true);
    expect(f.cancellationFee.equals(new Decimal(0))).toBe(true);
  });

  it("default collectType = UNKNOWN & fxRateToBase = 1", () => {
    const f = inferBookingFields(nb());
    expect(f.collectType).toBe("UNKNOWN");
    expect(f.fxRateToBase.equals(new Decimal(1))).toBe(true);
  });

  it("menjaga collectType & commission dari event", () => {
    const f = inferBookingFields(
      nb({ collectType: "CHANNEL_COLLECT", commissionAmount: "150000", commissionRate: "0.15" }),
    );
    expect(f.collectType).toBe("CHANNEL_COLLECT");
    expect(f.commissionAmount?.toString()).toBe("150000");
    expect(f.commissionRate?.toString()).toBe("0.15");
  });

  it("menormalisasi currency ke upper-case", () => {
    expect(inferBookingFields(nb({ currency: "idr" })).currency).toBe("IDR");
  });

  it("bookedAt null bila adapter tidak memberikan", () => {
    expect(inferBookingFields(nb()).bookedAt).toBeNull();
  });
});

describe("computeAllocation", () => {
  const IDR = "IDR" as const;

  it("tidak mengalokasikan saat status CANCELLED", () => {
    const d = computeAllocation({
      status: "CANCELLED",
      gross: new Decimal("1500000"),
      currency: IDR,
      units: [{ unitId: "U1" }],
    });
    expect(d.allocate).toBe(false);
    expect(d.tier).toBe("NONE");
    expect(d.rows).toHaveLength(0);
  });

  it("tidak mengalokasikan saat listing tanpa unit", () => {
    const d = computeAllocation({
      status: "CONFIRMED",
      gross: new Decimal("1500000"),
      currency: IDR,
      units: [],
    });
    expect(d.allocate).toBe(false);
    expect(d.tier).toBe("NONE");
  });

  it("mengalokasikan 100% ke satu unit", () => {
    const d = computeAllocation({
      status: "CONFIRMED",
      gross: new Decimal("1500000"),
      currency: IDR,
      units: [{ unitId: "U1" }],
    });
    expect(d.allocate).toBe(true);
    expect(d.tier).toBe("EQUAL_SPLIT");
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]?.unitId).toBe("U1");
    expect(d.rows[0]?.allocatedGross.toString()).toBe("1500000");
    expect(d.rows[0]?.allocationPct.toFixed(4)).toBe("1.0000");
  });

  it("membagi rata antar dua unit, sisa pembulatan ke unit terakhir", () => {
    const d = computeAllocation({
      status: "CONFIRMED",
      gross: new Decimal("1000001"),
      currency: IDR,
      units: [{ unitId: "U1" }, { unitId: "U2" }],
    });
    expect(d.tier).toBe("EQUAL_SPLIT");
    const total = d.rows.reduce((acc, r) => acc.plus(r.allocatedGross), new Decimal(0));
    expect(total.equals(new Decimal("1000001"))).toBe(true);
  });

  it("menghormati explicit weights", () => {
    const d = computeAllocation({
      status: "CONFIRMED",
      gross: new Decimal("1000000"),
      currency: IDR,
      units: [
        { unitId: "U1", allocationWeight: "3" },
        { unitId: "U2", allocationWeight: "1" },
      ],
    });
    expect(d.tier).toBe("EXPLICIT_WEIGHT");
    expect(d.rows[0]?.allocatedGross.toString()).toBe("750000");
    expect(d.rows[1]?.allocatedGross.toString()).toBe("250000");
  });

  it("memakai baseRate sebagai bobot bila explicit weight tidak lengkap", () => {
    const d = computeAllocation({
      status: "CONFIRMED",
      gross: new Decimal("1000000"),
      currency: IDR,
      units: [
        { unitId: "U1", baseRate: "900000" },
        { unitId: "U2", baseRate: "100000" },
      ],
    });
    expect(d.tier).toBe("BASE_RATE");
    const total = d.rows.reduce((acc, r) => acc.plus(r.allocatedGross), new Decimal(0));
    expect(total.equals(new Decimal("1000000"))).toBe(true);
  });

  it("memakai maxGuests sebagai bobot sebelum equal split", () => {
    const d = computeAllocation({
      status: "CONFIRMED",
      gross: new Decimal("1000000"),
      currency: IDR,
      units: [
        { unitId: "U1", maxGuests: 4 },
        { unitId: "U2", maxGuests: 2 },
      ],
    });
    expect(d.tier).toBe("MAX_GUESTS");
  });

  it("mempertahankan presisi 2 desimal untuk USD", () => {
    const d = computeAllocation({
      status: "CONFIRMED",
      gross: new Decimal("100.00"),
      currency: "USD",
      units: [{ unitId: "U1" }, { unitId: "U2" }],
    });
    const total = d.rows.reduce((acc, r) => acc.plus(r.allocatedGross), new Decimal(0));
    expect(total.toFixed(2)).toBe("100.00");
  });

  it("no_show tetap mengalokasikan (unit terisi, revenue tetap ada)", () => {
    const d = computeAllocation({
      status: "NO_SHOW",
      gross: new Decimal("1500000"),
      currency: IDR,
      units: [{ unitId: "U1" }],
    });
    expect(d.allocate).toBe(true);
  });
});
