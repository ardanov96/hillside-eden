import { describe, it, expect } from "vitest";
import { money } from "../lib/money";
import { Decimal } from "../lib/decimal";
import {
  allocateBookingToUnits,
  resolveAllocationWeights,
  type AllocatableUnit,
} from "./allocation";

const idr = (n: string | number) => money(n.toString(), "IDR");
const usd = (n: string | number) => money(n.toString(), "USD");

describe("estate-allocation (docs/05 §3 & §9.3)", () => {
  describe("Golden Case §9.3 (Estate 7 unit, gross Rp 14.000.000)", () => {
    it("7 unit dengan bobot sama rata -> tiap unit 2.000.000, total persis 14.000.000", () => {
      const units: AllocatableUnit[] = Array.from({ length: 7 }, (_, i) => ({
        unitId: `unit-${i + 1}`,
      }));
      const result = allocateBookingToUnits(idr(14000000), units);

      expect(result.tierUsed).toBe("EQUAL_SPLIT");
      expect(result.allocations).toHaveLength(7);
      for (const a of result.allocations) {
        expect(a.allocatedGross.amount.toString()).toBe("2000000");
      }
      const sumGross = result.allocations.reduce(
        (acc, a) => acc + Number(a.allocatedGross.amount.toString()),
        0,
      );
      expect(sumGross).toBe(14000000);

      // Persentase total = 1.0000
      const sumPct = result.allocations.reduce(
        (acc, a) => acc.plus(a.allocationPct),
        new Decimal(0),
      );
      expect(sumPct.toString()).toBe("1");
    });

    it("sisa pembulatan diserap unit terakhir saat nilai tidak terbagi habis", () => {
      const units: AllocatableUnit[] = Array.from({ length: 7 }, (_, i) => ({
        unitId: `unit-${i + 1}`,
      }));
      const result = allocateBookingToUnits(idr(14000001), units);

      // 14.000.001 / 7 = 2.000.000,14... -> round IDR 0 dp = 2.000.000
      // 6 slot pertama = 2.000.000 (total 12.000.000), slot terakhir = 2.000.001
      expect(result.allocations.slice(0, 6).map((a) => a.allocatedGross.amount.toString())).toEqual(
        ["2000000", "2000000", "2000000", "2000000", "2000000", "2000000"],
      );
      expect(result.allocations[6]!.allocatedGross.amount.toString()).toBe("2000001");

      const sumGross = result.allocations.reduce(
        (acc, a) => acc + Number(a.allocatedGross.amount.toString()),
        0,
      );
      expect(sumGross).toBe(14000001);
    });
  });

  describe("Prioritas penentuan bobot (docs/05 §3)", () => {
    it("Tier 1 (EXPLICIT_WEIGHT): ListingUnit.allocationWeight dipakai jika tersedia pada semua unit", () => {
      const units: AllocatableUnit[] = [
        { unitId: "villa", allocationWeight: "0.5" },
        { unitId: "cottage-1", allocationWeight: "0.3" },
        { unitId: "cottage-2", allocationWeight: "0.2" },
      ];
      const result = allocateBookingToUnits(idr(10000000), units);

      expect(result.tierUsed).toBe("EXPLICIT_WEIGHT");
      expect(result.allocations.map((a) => a.allocatedGross.amount.toString())).toEqual([
        "5000000",
        "3000000",
        "2000000",
      ]);
      expect(result.allocations.map((a) => a.allocationPct.toString())).toEqual([
        "0.5",
        "0.3",
        "0.2",
      ]);
    });

    it("Tier 2 (BASE_RATE): Unit.baseRate dipakai bila ada unit tanpa allocationWeight", () => {
      const units: AllocatableUnit[] = [
        { unitId: "villa", baseRate: idr(3000000) },
        { unitId: "cottage-1", baseRate: idr(1000000) },
      ];
      const result = allocateBookingToUnits(idr(8000000), units);

      expect(result.tierUsed).toBe("BASE_RATE");
      expect(result.allocations.map((a) => a.allocatedGross.amount.toString())).toEqual([
        "6000000",
        "2000000",
      ]);
      expect(result.allocations.map((a) => a.allocationPct.toString())).toEqual(["0.75", "0.25"]);
    });

    it("Tier 3 (MAX_GUESTS): Unit.maxGuests dipakai bila baseRate tidak lengkap", () => {
      const units: AllocatableUnit[] = [
        { unitId: "villa-besar", maxGuests: 6 },
        { unitId: "kamar-kecil", maxGuests: 2 },
      ];
      const result = allocateBookingToUnits(idr(4000000), units);

      expect(result.tierUsed).toBe("MAX_GUESTS");
      expect(result.allocations.map((a) => a.allocatedGross.amount.toString())).toEqual([
        "3000000",
        "1000000",
      ]);
      expect(result.allocations.map((a) => a.allocationPct.toString())).toEqual(["0.75", "0.25"]);
    });

    it("Tier 4 (EQUAL_SPLIT): fallback jika data bobot tidak lengkap di semua tingkat", () => {
      const units: AllocatableUnit[] = [
        { unitId: "u1", allocationWeight: "0.8", baseRate: idr(1000000), maxGuests: 4 },
        { unitId: "u2", allocationWeight: null, baseRate: null, maxGuests: null }, // incomplete
      ];
      const result = allocateBookingToUnits(idr(5000000), units);

      expect(result.tierUsed).toBe("EQUAL_SPLIT");
      expect(result.allocations.map((a) => a.allocatedGross.amount.toString())).toEqual([
        "2500000",
        "2500000",
      ]);
      expect(result.allocations.map((a) => a.allocationPct.toString())).toEqual(["0.5", "0.5"]);
    });
  });

  describe("Unit tunggal (single unit booking)", () => {
    it("alokasi 100% pada booking 1 unit", () => {
      const result = allocateBookingToUnits(idr(2500000), [{ unitId: "room-1" }]);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0]!.allocatedGross.amount.toString()).toBe("2500000");
      expect(result.allocations[0]!.allocationPct.toString()).toBe("1");
    });
  });

  describe("Mata uang dan presisi (OD-18: USD 2 dp, IDR 0 dp)", () => {
    it("USD dialokasikan dengan presisi 2 desimal, slot akhir serap sisa", () => {
      const units: AllocatableUnit[] = [{ unitId: "u1" }, { unitId: "u2" }, { unitId: "u3" }];
      const result = allocateBookingToUnits(usd("100.00"), units);

      expect(result.allocations.map((a) => a.allocatedGross.amount.toString())).toEqual([
        "33.33",
        "33.33",
        "33.34",
      ]);
      const sumUsd = result.allocations.reduce(
        (acc, a) => acc.plus(a.allocatedGross.amount),
        new Decimal(0),
      );
      expect(sumUsd.toString()).toBe("100");
    });
  });

  describe("Kasus tepi dan validasi", () => {
    it("gross 0 menghasilkan alokasi 0 di tiap unit dengan persentase tetap valid", () => {
      const units: AllocatableUnit[] = [
        { unitId: "u1", maxGuests: 3 },
        { unitId: "u2", maxGuests: 1 },
      ];
      const result = allocateBookingToUnits(idr(0), units);

      expect(result.tierUsed).toBe("MAX_GUESTS");
      expect(result.allocations.map((a) => a.allocatedGross.amount.toString())).toEqual(["0", "0"]);
      expect(result.allocations.map((a) => a.allocationPct.toString())).toEqual(["0.75", "0.25"]);
    });

    it("gross negatif throws", () => {
      expect(() => allocateBookingToUnits(idr(-1000), [{ unitId: "u1" }])).toThrow(/non-negative/);
    });

    it("units kosong throws", () => {
      expect(() => allocateBookingToUnits(idr(1000), [])).toThrow(/must not be empty/);
    });

    it("unitId duplikat throws", () => {
      expect(() => allocateBookingToUnits(idr(1000), [{ unitId: "u1" }, { unitId: "u1" }])).toThrow(
        /duplicate unitId/,
      );
    });

    it("unitId kosong/blank throws", () => {
      expect(() => allocateBookingToUnits(idr(1000), [{ unitId: "" }])).toThrow(/non-empty string/);
    });

    it("resolveAllocationWeights melempar error bila units kosong", () => {
      expect(() => resolveAllocationWeights([])).toThrow(/must not be empty/);
    });
  });
});
