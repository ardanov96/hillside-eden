import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  calculateIntervalOverlap,
  detectScheduleCollisions,
  type CollisionBooking,
} from "./collision";

describe("domain/collision property tests (fast-check invariants)", () => {
  // Arbitrary untuk tanggal menginap acak di tahun 2026
  const arbStayRange = fc
    .tuple(
      fc.integer({ min: 1, max: 200 }),
      fc.integer({ min: 1, max: 14 }), // lama menginap 1..14 malam
    )
    .map(([offset, duration]) => {
      const base = new Date(Date.UTC(2026, 0, 1) + offset * 86400000);
      const checkIn = base.toISOString().slice(0, 10);
      const checkOut = new Date(base.getTime() + duration * 86400000).toISOString().slice(0, 10);
      return { checkIn, checkOut, duration };
    });

  it("Invariant 1: Overlap selalu memiliki overlapStart < overlapEnd dan overlapNights >= 1", () => {
    fc.assert(
      fc.property(arbStayRange, arbStayRange, (rangeA, rangeB) => {
        const overlap = calculateIntervalOverlap(
          rangeA.checkIn,
          rangeA.checkOut,
          rangeB.checkIn,
          rangeB.checkOut,
        );
        if (overlap) {
          expect(overlap.overlapStart < overlap.overlapEnd).toBe(true);
          expect(overlap.overlapNights).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("Invariant 2: Urutan input booking tidak mengubah set bentrok yang terdeteksi (Order invariance)", () => {
    const arbBookingsList = fc.integer({ min: 2, max: 6 }).chain((count) => {
      const items: fc.Arbitrary<CollisionBooking>[] = [];
      for (let i = 0; i < count; i++) {
        items.push(
          arbStayRange.map((r) => ({
            id: `b-${i}`,
            status: "CONFIRMED" as const,
            unitIds: ["unit-shared"],
            checkIn: r.checkIn,
            checkOut: r.checkOut,
          })),
        );
      }
      return fc.tuple(...items);
    });

    fc.assert(
      fc.property(arbBookingsList, (bookings) => {
        const reportNormal = detectScheduleCollisions({ bookings });
        const shuffled = [...bookings].reverse();
        const reportShuffled = detectScheduleCollisions({ bookings: shuffled });

        // Jumlah bentrok harus sama persis
        expect(reportNormal.collisions.length).toBe(reportShuffled.collisions.length);

        const idsNormal = new Set(reportNormal.collisions.map((c) => c.id));
        const idsShuffled = new Set(reportShuffled.collisions.map((c) => c.id));
        expect(idsNormal).toEqual(idsShuffled);
      }),
      { numRuns: 100 },
    );
  });

  it("Invariant 3: Tidak pernah ada bentrok antara booking dengan dirinya sendiri", () => {
    fc.assert(
      fc.property(arbStayRange, (r) => {
        const booking: CollisionBooking = {
          id: "single-booking",
          status: "CONFIRMED",
          unitIds: ["unit-1", "unit-2"],
          checkIn: r.checkIn,
          checkOut: r.checkOut,
        };
        const report = detectScheduleCollisions({ bookings: [booking] });
        expect(report.hasCollisions).toBe(false);
        expect(report.collisions).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it("Invariant 4: Jika dua booking bentrok pada unit U, keduanya dipastikan memuat unit U", () => {
    const arbMultiUnitBookings = fc.integer({ min: 2, max: 5 }).chain((count) => {
      const items: fc.Arbitrary<CollisionBooking>[] = [];
      for (let i = 0; i < count; i++) {
        items.push(
          fc
            .tuple(arbStayRange, fc.subarray(["u1", "u2", "u3"], { minLength: 1 }))
            .map(([r, units]) => ({
              id: `b-${i}`,
              status: "CONFIRMED" as const,
              unitIds: units,
              checkIn: r.checkIn,
              checkOut: r.checkOut,
            })),
        );
      }
      return fc.tuple(...items);
    });

    fc.assert(
      fc.property(arbMultiUnitBookings, (bookings) => {
        const report = detectScheduleCollisions({ bookings });
        for (const col of report.collisions) {
          if (col.kind === "BOOKING_VS_BOOKING") {
            expect(col.bookingA.unitIds).toContain(col.unitId);
            expect(col.bookingB?.unitIds).toContain(col.unitId);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
