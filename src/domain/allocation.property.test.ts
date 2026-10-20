import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { money, sum, type Currency } from "../lib/money";
import { Decimal } from "../lib/decimal";
import {
  allocateBookingToUnits,
  resolveAllocationWeights,
  type AllocatableUnit,
} from "./allocation";

describe("estate-allocation property tests (fast-check invariants)", () => {
  // Arbitrary untuk Currency
  const arbCurrency: fc.Arbitrary<Currency> = fc.constantFrom("IDR", "USD");

  // Arbitrary untuk gross: IDR bulat 1.000..100.000.000, USD 10.00..5.000.00
  const arbMoney = arbCurrency.chain((curr) => {
    if (curr === "IDR") {
      return fc.integer({ min: 1, max: 100_000_000 }).map((n) => money(n.toString(), "IDR"));
    }
    return fc
      .integer({ min: 100, max: 500_000 })
      .map((cents) => money((cents / 100).toFixed(2), "USD"));
  });

  // Arbitrary untuk daftar unit acak dengan ID unik (1 sampai 12 unit)
  const arbUnitList = fc.integer({ min: 1, max: 12 }).chain((count) => {
    const units: fc.Arbitrary<AllocatableUnit>[] = [];
    for (let i = 0; i < count; i++) {
      units.push(
        fc.record({
          unitId: fc.constant(`u-${i}`),
          allocationWeight: fc.option(
            fc.integer({ min: 1, max: 100 }).map((n) => (n / 10).toString()),
            { nil: undefined },
          ),
          baseRate: fc.option(
            fc.integer({ min: 100_000, max: 5_000_000 }).map((n) => n.toString()),
            { nil: undefined },
          ),
          maxGuests: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
        }),
      );
    }
    return fc.tuple(...units);
  });

  it("Invariant 1: Σ allocatedGross selalu persis identik dengan totalGross (200 runs)", () => {
    fc.assert(
      fc.property(arbMoney, arbUnitList, (gross, units) => {
        const result = allocateBookingToUnits(gross, units);
        const slices = result.allocations.map((a) => a.allocatedGross);
        const totalAllocated = sum(slices, gross.currency);

        expect(totalAllocated.amount.toString()).toBe(gross.amount.toString());
      }),
      { numRuns: 200 },
    );
  });

  it("Invariant 2: Σ allocationPct selalu tepat 1.0000 (100%) (150 runs)", () => {
    fc.assert(
      fc.property(arbMoney, arbUnitList, (gross, units) => {
        const result = allocateBookingToUnits(gross, units);
        const totalPct = result.allocations.reduce(
          (acc, a) => acc.plus(a.allocationPct),
          new Decimal(0),
        );

        expect(totalPct.toDecimalPlaces(4).toString()).toBe("1");
      }),
      { numRuns: 150 },
    );
  });

  it("Invariant 3: Single unit booking selalu mendapat 100% dan pct 1.0000", () => {
    fc.assert(
      fc.property(arbMoney, (gross) => {
        const result = allocateBookingToUnits(gross, [{ unitId: "single-u" }]);
        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0]!.allocatedGross.amount.toString()).toBe(
          gross.amount.toString(),
        );
        expect(result.allocations[0]!.allocationPct.toString()).toBe("1");
      }),
      { numRuns: 100 },
    );
  });

  it("Invariant 4: Tidak ada alokasi yang menghasilkan angka negatif jika gross non-negatif", () => {
    fc.assert(
      fc.property(arbMoney, arbUnitList, (gross, units) => {
        const result = allocateBookingToUnits(gross, units);
        for (const a of result.allocations) {
          expect(a.allocatedGross.amount.isNegative()).toBe(false);
          expect(a.allocationPct.isNegative()).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Invariant 5: Bobot sama rata membagi nilai dengan selisih maks 1 minor unit", () => {
    fc.assert(
      fc.property(arbMoney, fc.integer({ min: 2, max: 10 }), (gross, count) => {
        const units: AllocatableUnit[] = Array.from({ length: count }, (_, i) => ({
          unitId: `eq-${i}`,
        }));
        const result = allocateBookingToUnits(gross, units);

        expect(result.tierUsed).toBe("EQUAL_SPLIT");
        const amounts = result.allocations.map((a) => a.allocatedGross.amount);
        const min = amounts.reduce((a, b) => (a.lessThan(b) ? a : b));
        const max = amounts.reduce((a, b) => (a.greaterThan(b) ? a : b));
        const diff = max.minus(min);

        // Tiap slot dari N-1 unit dibulatkan half-up, dengan selisih maks 0.5 minor unit per unit.
        // Slot terakhir menyerap sisa kumulatif, sehingga selisih maks terhadap slot lain
        // adalah ceil(count / 2) * minor unit.
        const oneMinorUnit = gross.currency === "IDR" ? new Decimal(1) : new Decimal("0.01");
        const maxAllowedDiff = oneMinorUnit.times(Math.ceil(count / 2));
        expect(diff.lessThanOrEqualTo(maxAllowedDiff)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Invariant 6: Prioritas tier resolusi bobot selalu konsisten", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 5 }), (count) => {
        // Semua punya allocationWeight -> EXPLICIT_WEIGHT
        const fullExplicit: AllocatableUnit[] = Array.from({ length: count }, (_, i) => ({
          unitId: `u-${i}`,
          allocationWeight: (i + 1).toString(),
          baseRate: (100_000 * (i + 1)).toString(),
          maxGuests: i + 1,
        }));
        expect(resolveAllocationWeights(fullExplicit).tier).toBe("EXPLICIT_WEIGHT");

        // Satu hilang allocationWeight -> fallback ke BASE_RATE
        const dropWeight = fullExplicit.map((u, i) =>
          i === 0 ? { ...u, allocationWeight: undefined } : u,
        );
        expect(resolveAllocationWeights(dropWeight).tier).toBe("BASE_RATE");

        // Satu hilang baseRate -> fallback ke MAX_GUESTS
        const dropBaseRate = dropWeight.map((u, i) =>
          i === 0 ? { ...u, baseRate: undefined } : u,
        );
        expect(resolveAllocationWeights(dropBaseRate).tier).toBe("MAX_GUESTS");

        // Satu hilang maxGuests -> fallback ke EQUAL_SPLIT
        const dropMaxGuests = dropBaseRate.map((u, i) =>
          i === 0 ? { ...u, maxGuests: undefined } : u,
        );
        expect(resolveAllocationWeights(dropMaxGuests).tier).toBe("EQUAL_SPLIT");
      }),
      { numRuns: 50 },
    );
  });
});
