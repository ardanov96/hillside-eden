import { describe, it, expect } from "vitest";
import { money } from "../lib/money";
import {
  computeBookedKpis,
  computePaceKpis,
  computeStayKpis,
  nightlyAllocation,
  type KpiBooking,
  type KpiProperty,
  type KpiUnit,
  type Period,
} from "./kpi";

const m = (n: string) => money(n, "IDR");

function unit(id: string, propertyId: string, sellable: boolean): KpiUnit {
  return { id, propertyId, isSellable: () => sellable };
}

function period(start: string, end: string): Period {
  return { start, end };
}

describe("nightlyAllocation (docs/05 s9.1)", () => {
  it("3,000,001 / 3 -> [1.000.000, 1.000.000, 1.000.001] (IDR 0 dp, slot akhir serap sisa)", () => {
    const result = nightlyAllocation(m("3000001"), 3);
    expect(result.map((r) => r.amount.toString())).toEqual(["1000000", "1000000", "1000001"]);
  });

  it("1,000,000 / 3 -> [333333, 333333, 333334] (IDR 0 dp)", () => {
    const result = nightlyAllocation(m("1000000"), 3);
    expect(result.map((r) => r.amount.toString())).toEqual(["333333", "333333", "333334"]);
  });

  it("nights = 1 -> single rounded slice (IDR 0 dp)", () => {
    const result = nightlyAllocation(m("1234567.89"), 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.amount.toString()).toBe("1234568");
  });

  it("USD 100 / 3 -> [33.33, 33.33, 33.34] (USD 2 dp)", () => {
    const result = nightlyAllocation(money("100", "USD"), 3);
    expect(result.map((r) => r.amount.toString())).toEqual(["33.33", "33.33", "33.34"]);
  });

  it("nights = 0 atau non-integer throws", () => {
    expect(() => nightlyAllocation(m("1000"), 0)).toThrow(/positive integer/);
    expect(() => nightlyAllocation(m("1000"), 1.5)).toThrow(/positive integer/);
    expect(() => nightlyAllocation(m("1000"), -3)).toThrow(/positive integer/);
  });

  it("gross negatif throws", () => {
    expect(() => nightlyAllocation(m("-1"), 3)).toThrow(/non-negative/);
  });
});

describe("computeStayKpis (docs/05 s9.2 - booking crossing period)", () => {
  const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };
  const booking: KpiBooking = {
    id: "b1",
    propertyId: "p1",
    unitIds: ["u1"],
    checkIn: "2026-10-30",
    checkOut: "2026-11-03",
    status: "CONFIRMED",
    bookedAt: new Date("2026-09-15T10:00:00Z"),
    grossAmount: m("4000000"),
  };

  it("Oktober segment: 30, 31 Oct (2 malam, 2M)", () => {
    const r = computeStayKpis(
      { properties: [prop], bookings: [booking] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.soldNights).toBe(2);
    expect(r.grossRevenue.amount.toString()).toBe("2000000");
  });

  it("November segment: 1, 2 Nov (2 malam, 2M)", () => {
    const r = computeStayKpis(
      { properties: [prop], bookings: [booking] },
      period("2026-11-01", "2026-12-01"),
    );
    expect(r.soldNights).toBe(2);
    expect(r.grossRevenue.amount.toString()).toBe("2000000");
  });
});

describe("computeStayKpis (docs/05 s9.3 - estate 7 unit)", () => {
  it("estate 7 unit, gross 14M, 7 malam -> sold = 49, total revenue tetap 14M", () => {
    const prop: KpiProperty = {
      id: "p1",
      units: Array.from({ length: 7 }, (_, i) => unit(`u${i}`, "p1", true)),
    };
    const booking: KpiBooking = {
      id: "b1",
      propertyId: "p1",
      unitIds: Array.from({ length: 7 }, (_, i) => `u${i}`),
      checkIn: "2026-10-19",
      checkOut: "2026-10-26",
      status: "CONFIRMED",
      bookedAt: new Date("2026-09-01T00:00:00Z"),
      grossAmount: m("14000000"),
    };
    const r = computeStayKpis(
      { properties: [prop], bookings: [booking] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.soldNights).toBe(7 * 7);
    expect(r.availableNights).toBe(7 * 31);
    expect(r.grossRevenue.amount.toString()).toBe("14000000");
    expect(r.occupancy).toBeCloseTo((7 * 7) / (7 * 31), 5);
  });
});

describe("computeStayKpis (docs/05 s9.4 - combined occupancy = total/total)", () => {
  it("gabungan 4+1 unit, sold=31 -> occupancy = 31/155", () => {
    const propA: KpiProperty = {
      id: "p1",
      units: Array.from({ length: 4 }, (_, i) => unit(`a${i}`, "p1", true)),
    };
    const propB: KpiProperty = { id: "p2", units: [unit("b0", "p2", true)] };
    const booking: KpiBooking = {
      id: "b1",
      propertyId: "p2",
      unitIds: ["b0"],
      checkIn: "2026-10-01",
      checkOut: "2026-11-01",
      status: "CONFIRMED",
      bookedAt: new Date("2026-09-01T00:00:00Z"),
      grossAmount: m("31000000"),
    };
    const r = computeStayKpis(
      { properties: [propA, propB], bookings: [booking] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.soldNights).toBe(31);
    expect(r.availableNights).toBe(5 * 31);
    expect(r.occupancy).toBeCloseTo(31 / 155, 5);
    expect(r.occupancy).not.toBeCloseTo(0.5, 1);
  });
});

describe("computeStayKpis (docs/05 s9.5 - cancelled with fee)", () => {
  it("CANCELLED dgn fee: hanya fee, tanpa sold night, ADR null", () => {
    const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };
    const booking: KpiBooking = {
      id: "b1",
      propertyId: "p1",
      unitIds: ["u1"],
      checkIn: "2026-10-19",
      checkOut: "2026-10-22",
      status: "CANCELLED",
      bookedAt: new Date("2026-09-01T00:00:00Z"),
      grossAmount: m("3000000"),
      cancellationFee: m("500000"),
    };
    const r = computeStayKpis(
      { properties: [prop], bookings: [booking] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.soldNights).toBe(0);
    expect(r.grossRevenue.amount.toString()).toBe("0");
    expect(r.cancellationFeeRevenue.amount.toString()).toBe("500000");
    expect(r.adr).toBeNull();
  });

  it("fee di luar P tidak dihitung", () => {
    const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };
    const booking: KpiBooking = {
      id: "b1",
      propertyId: "p1",
      unitIds: ["u1"],
      checkIn: "2026-11-19",
      checkOut: "2026-11-22",
      status: "CANCELLED",
      bookedAt: new Date("2026-09-01T00:00:00Z"),
      grossAmount: m("3000000"),
      cancellationFee: m("500000"),
    };
    const r = computeStayKpis(
      { properties: [prop], bookings: [booking] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.cancellationFeeRevenue.amount.toString()).toBe("0");
  });
});

describe("computeStayKpis status rules (docs/05 s4)", () => {
  const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };

  it("PENDING diabaikan", () => {
    const r = computeStayKpis(
      {
        properties: [prop],
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-19",
            checkOut: "2026-10-22",
            status: "PENDING",
            bookedAt: new Date("2026-09-01T00:00:00Z"),
            grossAmount: m("3000000"),
          },
        ],
      },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.soldNights).toBe(0);
    expect(r.grossRevenue.amount.toString()).toBe("0");
  });

  it("CANCELLED tanpa fee: semua 0", () => {
    const r = computeStayKpis(
      {
        properties: [prop],
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-19",
            checkOut: "2026-10-22",
            status: "CANCELLED",
            bookedAt: new Date("2026-09-01T00:00:00Z"),
            grossAmount: m("3000000"),
          },
        ],
      },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.soldNights).toBe(0);
    expect(r.grossRevenue.amount.toString()).toBe("0");
    expect(r.cancellationFeeRevenue.amount.toString()).toBe("0");
  });

  it("NO_SHOW dengan fee: seperti CANCELLED dengan fee", () => {
    const r = computeStayKpis(
      {
        properties: [prop],
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-19",
            checkOut: "2026-10-22",
            status: "NO_SHOW",
            bookedAt: new Date("2026-09-01T00:00:00Z"),
            grossAmount: m("3000000"),
            cancellationFee: m("3000000"),
          },
        ],
      },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.soldNights).toBe(0);
    expect(r.cancellationFeeRevenue.amount.toString()).toBe("3000000");
  });
});

describe("ADR and RevPAR (docs/05 s1 - presisi penuh, raw Decimal)", () => {
  const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };
  const booking: KpiBooking = {
    id: "b1",
    propertyId: "p1",
    unitIds: ["u1"],
    checkIn: "2026-10-19",
    checkOut: "2026-10-22",
    status: "CONFIRMED",
    bookedAt: new Date("2026-09-01T00:00:00Z"),
    grossAmount: m("3000000"),
  };

  it("ADR = grossRevenue / soldNights (raw Decimal)", () => {
    const r = computeStayKpis(
      { properties: [prop], bookings: [booking] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.adr).not.toBeNull();
    // 3,000,000 / 3 = 1,000,000 exact, raw IDR
    expect(r.adr?.amount.toString()).toBe("1000000");
  });

  it("RevPAR = grossRevenue / availableNights (raw Decimal, presisi penuh)", () => {
    const r = computeStayKpis(
      { properties: [prop], bookings: [booking] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.revpar).not.toBeNull();
    // 3,000,000 / 31 raw Decimal (no rounding applied in domain)
    const v = r.revpar!.amount;
    expect(v.times(31).equals(3000000)).toBe(true);
    // Pembulatan 2 dp (format display) -> 96774.19
    expect(v.toDecimalPlaces(2, 4 /* ROUND_HALF_UP */).toString()).toBe("96774.19");
  });

  it("ADR null bila soldNights = 0", () => {
    const r = computeStayKpis(
      { properties: [prop], bookings: [] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.adr).toBeNull();
    expect(r.revpar).not.toBeNull();
    expect(r.revpar?.amount.toString()).toBe("0");
  });

  it("RevPAR null bila availableNights = 0 (tidak ada sellable unit)", () => {
    const emptyProp: KpiProperty = { id: "p1", units: [] };
    const r = computeStayKpis(
      { properties: [emptyProp], bookings: [] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.availableNights).toBe(0);
    expect(r.revpar).toBeNull();
  });
});

describe("computeBookedKpis (docs/05 s9.6 - lead time, cancellation rate)", () => {
  const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };

  it("leadTime = checkIn - bookedAt (hari)", () => {
    const r = computeBookedKpis(
      {
        properties: [prop],
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-19",
            checkOut: "2026-10-22",
            status: "CONFIRMED",
            bookedAt: new Date("2026-10-09T00:00:00Z"),
            grossAmount: m("3000000"),
          },
        ],
      },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.bookedCount).toBe(1);
    expect(r.cancelledCount).toBe(0);
    expect(r.cancellationRate).toBe(0);
    expect(r.leadTimeDays).toBeCloseTo(10, 5);
  });

  it("cancellationRate = cancelled / all (NO_SHOW ikut cancelled)", () => {
    const r = computeBookedKpis(
      {
        properties: [prop],
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-19",
            checkOut: "2026-10-22",
            status: "CONFIRMED",
            bookedAt: new Date("2026-10-09T00:00:00Z"),
            grossAmount: m("3000000"),
          },
          {
            id: "b2",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-20",
            checkOut: "2026-10-22",
            status: "CANCELLED",
            bookedAt: new Date("2026-10-10T00:00:00Z"),
            grossAmount: m("2000000"),
          },
          {
            id: "b3",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-25",
            checkOut: "2026-10-27",
            status: "NO_SHOW",
            bookedAt: new Date("2026-10-11T00:00:00Z"),
            grossAmount: m("2000000"),
          },
        ],
      },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.bookedCount).toBe(3);
    expect(r.cancelledCount).toBe(2);
    expect(r.cancellationRate).toBeCloseTo(2 / 3, 5);
  });

  it("null saat tidak ada bookings dengan bookedAt di period", () => {
    const r = computeBookedKpis(
      { properties: [prop], bookings: [] },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.bookedCount).toBe(0);
    expect(r.cancellationRate).toBeNull();
    expect(r.leadTimeDays).toBeNull();
  });

  it("bookings tanpa bookedAt diabaikan", () => {
    const r = computeBookedKpis(
      {
        properties: [prop],
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-19",
            checkOut: "2026-10-22",
            status: "CONFIRMED",
            bookedAt: null,
            grossAmount: m("3000000"),
          },
        ],
      },
      period("2026-10-01", "2026-11-01"),
    );
    expect(r.bookedCount).toBe(0);
  });
});

describe("computePaceKpis (docs/05 s9.7 - benchmark YoY)", () => {
  const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };

  it("bandingkan current vs prior year pada asOf yang sama", () => {
    const r = computePaceKpis(
      {
        properties: [prop],
        bookings: [
          {
            id: "prior-1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2025-11-10",
            checkOut: "2025-11-13",
            status: "CONFIRMED",
            bookedAt: new Date("2025-09-15T00:00:00Z"),
            grossAmount: m("3000000"),
          },
          {
            id: "prior-2",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2025-11-20",
            checkOut: "2025-11-22",
            status: "CONFIRMED",
            bookedAt: new Date("2025-09-20T00:00:00Z"),
            grossAmount: m("2000000"),
          },
          {
            id: "cur-1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-11-10",
            checkOut: "2026-11-13",
            status: "CONFIRMED",
            bookedAt: new Date("2026-09-15T00:00:00Z"),
            grossAmount: m("3000000"),
          },
        ],
      },
      period("2026-11-01", "2026-12-01"),
      period("2025-11-01", "2025-12-01"),
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(r.upcomingBookings).toBe(1);
    expect(r.priorYearBookings).toBe(2);
    expect(r.bookingPaceRatio).toBeCloseTo(0.5, 5);
  });

  it("null saat tidak ada prior period", () => {
    const r = computePaceKpis(
      { properties: [prop], bookings: [] },
      period("2026-11-01", "2026-12-01"),
      period("2025-11-01", "2025-12-01"),
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(r.bookingPaceRatio).toBeNull();
    expect(r.revenuePaceRatio).toBeNull();
  });
});

describe("validation", () => {
  const prop: KpiProperty = { id: "p1", units: [unit("u1", "p1", true)] };

  it("CONFIRMED tanpa unitIds -> throw", () => {
    expect(() =>
      computeStayKpis(
        {
          properties: [prop],
          bookings: [
            {
              id: "b1",
              propertyId: "p1",
              unitIds: [],
              checkIn: "2026-10-19",
              checkOut: "2026-10-22",
              status: "CONFIRMED",
              bookedAt: new Date("2026-09-01T00:00:00Z"),
              grossAmount: m("3000000"),
            },
          ],
        },
        period("2026-10-01", "2026-11-01"),
      ),
    ).toThrow(/CONFIRMED must have at least one unitId/);
  });

  it("checkOut <= checkIn -> throw", () => {
    expect(() =>
      computeStayKpis(
        {
          properties: [prop],
          bookings: [
            {
              id: "b1",
              propertyId: "p1",
              unitIds: ["u1"],
              checkIn: "2026-10-22",
              checkOut: "2026-10-22",
              status: "CONFIRMED",
              bookedAt: new Date("2026-09-01T00:00:00Z"),
              grossAmount: m("3000000"),
            },
          ],
        },
        period("2026-10-01", "2026-11-01"),
      ),
    ).toThrow(/checkOut must be > checkIn/);
  });

  it("currency mismatch -> throw", () => {
    expect(() =>
      computeStayKpis(
        {
          properties: [prop],
          bookings: [
            {
              id: "b1",
              propertyId: "p1",
              unitIds: ["u1"],
              checkIn: "2026-10-19",
              checkOut: "2026-10-22",
              status: "CONFIRMED",
              bookedAt: new Date("2026-09-01T00:00:00Z"),
              grossAmount: money("1000", "USD"),
            },
          ],
        },
        period("2026-10-01", "2026-11-01"),
      ),
    ).toThrow(/currency USD/);
  });

  it("periode invalid (end <= start) -> throw", () => {
    expect(() =>
      computeStayKpis({ properties: [prop], bookings: [] }, period("2026-11-01", "2026-10-01")),
    ).toThrow(/end must be > start/);
  });
});
