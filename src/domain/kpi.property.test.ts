import { describe, it } from "vitest";
import fc from "fast-check";
import { Decimal } from "../lib/decimal";
import { money } from "../lib/money";
import {
  computeBookedKpis,
  computePaceKpis,
  computeStayKpis,
  nightlyAllocation,
  type KpiBooking,
  type KpiBookingStatus,
  type KpiProperty,
} from "./kpi";

const m = (n: string) => money(n, "IDR");

const ALL_STATUSES = [
  "CONFIRMED",
  "PENDING",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly KpiBookingStatus[];
const STATUSES_FOR_BOOKED = [
  "CONFIRMED",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly KpiBookingStatus[];

function stayWindowArb(): fc.Arbitrary<{ checkIn: string; checkOut: string }> {
  return fc
    .tuple(
      fc
        .date({ min: new Date("2026-01-01T00:00:00Z"), max: new Date("2026-11-01T00:00:00Z") })
        .map((d) => d.toISOString().slice(0, 10)),
      fc.integer({ min: 1, max: 7 }),
    )
    .map(([checkIn, nights]) => {
      const ci = new Date(checkIn + "T00:00:00Z");
      const co = new Date(ci.getTime() + nights * 86400000);
      return { checkIn, checkOut: co.toISOString().slice(0, 10) };
    });
}

describe("nightlyAllocation properties", () => {
  it("sum(daily slices) === gross (IDR)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000000 }),
        fc.integer({ min: 1, max: 30 }),
        (gross, nights) => {
          const slices = nightlyAllocation(m(String(gross)), nights);
          const total = slices.reduce((acc, s) => acc.plus(s.amount), new Decimal(0));
          return total.equals(gross);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("sum(daily slices) === gross (USD 2dp)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 1, max: 30 }),
        (gross, nights) => {
          const slices = nightlyAllocation(money(String(gross), "USD"), nights);
          const total = slices.reduce((acc, s) => acc.plus(s.amount), new Decimal(0));
          return total.equals(gross);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("N-1 slots pertama sama satu sama lain (IDR 0 dp)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),
        fc.integer({ min: 2, max: 30 }),
        (gross, nights) => {
          const slices = nightlyAllocation(m(String(gross)), nights);
          const first = slices[0]!.amount.toString();
          for (let i = 1; i < nights - 1; i++) {
            if (slices[i]!.amount.toString() !== first) return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects invalid nights (0, negative, non-integer)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 5 }).filter((n) => !(Number.isInteger(n) && n > 0)),
        (nights) => {
          try {
            nightlyAllocation(m("1000"), nights);
            return false;
          } catch {
            return true;
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("computeStayKpis invariants", () => {
  it("soldNights <= availableNights untuk bookings dalam window", () => {
    fc.assert(
      fc.property(stayWindowArb(), ({ checkIn, checkOut }) => {
        const prop: KpiProperty = {
          id: "p1",
          units: [{ id: "u1", propertyId: "p1", isSellable: () => true }],
        };
        const bookings: KpiBooking[] = [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn,
            checkOut,
            status: "CONFIRMED",
            bookedAt: new Date("2026-09-01T00:00:00Z"),
            grossAmount: m("3000000"),
          },
        ];
        const r = computeStayKpis(
          { properties: [prop], bookings },
          { start: "2026-09-01", end: "2026-12-01" },
        );
        return r.soldNights <= r.availableNights;
      }),
      { numRuns: 100 },
    );
  });

  it("occupancy in [0, 1]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), stayWindowArb(), (units, w) => {
        const prop: KpiProperty = {
          id: "p1",
          units: Array.from({ length: units }, (_, i) => ({
            id: `u${i}`,
            propertyId: "p1",
            isSellable: () => true,
          })),
        };
        const bookings: KpiBooking[] = [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: Array.from({ length: units }, (_, i) => `u${i}`),
            checkIn: w.checkIn,
            checkOut: w.checkOut,
            status: "CONFIRMED",
            bookedAt: new Date("2026-09-01T00:00:00Z"),
            grossAmount: m("3000000"),
          },
        ];
        const r = computeStayKpis(
          { properties: [prop], bookings },
          { start: "2026-10-01", end: "2026-11-01" },
        );
        return r.occupancy >= 0 && r.occupancy <= 1;
      }),
      { numRuns: 50 },
    );
  });

  it("ADR x soldNights === grossRevenue (Decimal)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 100, max: 99999999 }),
        (nights, gross) => {
          const prop: KpiProperty = {
            id: "p1",
            units: [{ id: "u1", propertyId: "p1", isSellable: () => true }],
          };
          const ci = new Date("2026-10-19T00:00:00Z");
          const co = new Date(ci.getTime() + nights * 86400000);
          const bookings: KpiBooking[] = [
            {
              id: "b1",
              propertyId: "p1",
              unitIds: ["u1"],
              checkIn: ci.toISOString().slice(0, 10),
              checkOut: co.toISOString().slice(0, 10),
              status: "CONFIRMED",
              bookedAt: new Date("2026-09-01T00:00:00Z"),
              grossAmount: m(String(gross)),
            },
          ];
          const r = computeStayKpis(
            { properties: [prop], bookings },
            { start: "2026-10-01", end: "2026-11-01" },
          );
          const expected = r.grossRevenue.amount.dividedBy(r.soldNights);
          return r.adr!.amount.equals(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("PENDING tidak pernah dihitung", () => {
    fc.assert(
      fc.property(stayWindowArb(), ({ checkIn, checkOut }) => {
        const prop: KpiProperty = {
          id: "p1",
          units: [{ id: "u1", propertyId: "p1", isSellable: () => true }],
        };
        const bookings: KpiBooking[] = [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn,
            checkOut,
            status: "PENDING",
            bookedAt: new Date("2026-09-01T00:00:00Z"),
            grossAmount: m("3000000"),
          },
        ];
        const r = computeStayKpis(
          { properties: [prop], bookings },
          { start: "2026-10-01", end: "2026-11-01" },
        );
        return r.soldNights === 0 && r.grossRevenue.amount.equals(0);
      }),
      { numRuns: 50 },
    );
  });

  it("CANCELLED fee: keyed on checkIn in period, not nights span", () => {
    fc.assert(
      fc.property(fc.boolean(), (inside) => {
        const prop: KpiProperty = {
          id: "p1",
          units: [{ id: "u1", propertyId: "p1", isSellable: () => true }],
        };
        const checkIn = inside ? "2026-10-19" : "2026-12-19";
        const checkOut = inside ? "2026-10-22" : "2026-12-22";
        const bookings: KpiBooking[] = [
          {
            id: "b1",
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn,
            checkOut,
            status: "CANCELLED",
            bookedAt: new Date("2026-09-01T00:00:00Z"),
            grossAmount: m("3000000"),
            cancellationFee: m("500000"),
          },
        ];
        const r = computeStayKpis(
          { properties: [prop], bookings },
          { start: "2026-10-01", end: "2026-11-01" },
        );
        const expected = inside ? "500000" : "0";
        return r.cancellationFeeRevenue.amount.toString() === expected;
      }),
      { numRuns: 20 },
    );
  });
});

describe("computeBookedKpis invariants", () => {
  it("cancellationRate sesuai ratio cancelled/total, null bila tidak ada", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.constantFrom<KpiBookingStatus>(...STATUSES_FOR_BOOKED),
            with: fc.boolean(),
          }),
          { maxLength: 6 },
        ),
        (mix) => {
          const prop: KpiProperty = {
            id: "p1",
            units: [{ id: "u1", propertyId: "p1", isSellable: () => true }],
          };
          const bookings: KpiBooking[] = mix.map((x, i) => ({
            id: `b${i}`,
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-10-19",
            checkOut: "2026-10-22",
            status: x.status,
            bookedAt: x.with ? new Date("2026-10-09T00:00:00Z") : null,
            grossAmount: m("1000000"),
          }));
          const r = computeBookedKpis(
            { properties: [prop], bookings },
            { start: "2026-10-01", end: "2026-11-01" },
          );
          if (r.bookedCount === 0) return r.cancellationRate === null;
          return Math.abs((r.cancellationRate ?? 0) - r.cancelledCount / r.bookedCount) < 1e-9;
        },
      ),
      { numRuns: 80 },
    );
  });
});

describe("computePaceKpis invariants", () => {
  it("bookingPaceRatio = cur/prior; null bila prior = 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (cur, prior) => {
          const prop: KpiProperty = {
            id: "p1",
            units: [{ id: "u1", propertyId: "p1", isSellable: () => true }],
          };
          const fakeCur: KpiBooking[] = Array.from({ length: cur }, (_, i) => ({
            id: `cur-${i}`,
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2026-11-10",
            checkOut: "2026-11-13",
            status: "CONFIRMED",
            bookedAt: new Date("2026-09-15T00:00:00Z"),
            grossAmount: m("1000000"),
          }));
          const fakePrior: KpiBooking[] = Array.from({ length: prior }, (_, i) => ({
            id: `prior-${i}`,
            propertyId: "p1",
            unitIds: ["u1"],
            checkIn: "2025-11-10",
            checkOut: "2025-11-13",
            status: "CONFIRMED",
            bookedAt: new Date("2025-09-15T00:00:00Z"),
            grossAmount: m("1000000"),
          }));
          const r = computePaceKpis(
            { properties: [prop], bookings: [...fakeCur, ...fakePrior] },
            { start: "2026-11-01", end: "2026-12-01" },
            { start: "2025-11-01", end: "2025-12-01" },
            new Date("2026-10-01T00:00:00Z"),
          );
          if (prior === 0) return r.bookingPaceRatio === null;
          return Math.abs((r.bookingPaceRatio ?? 0) - cur / prior) < 1e-9;
        },
      ),
      { numRuns: 60 },
    );
  });
});

// Used to keep ALL_STATUSES referenced in lint/typecheck
void ALL_STATUSES;
