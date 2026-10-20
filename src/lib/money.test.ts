import { describe, it, expect } from "vitest";
import {
  money,
  zero,
  add,
  sub,
  mul,
  div,
  neg,
  sum,
  isZero,
  isPositive,
  isNegative,
  equals,
  compare,
  round,
  allocateEvenly,
  allocateByWeights,
  convert,
  parseMoney,
} from "./money";

const idr = (n: number | string) => money(n, "IDR");
const usd = (n: number | string) => money(n, "USD");

describe("money", () => {
  describe("constructors", () => {
    it("creates Money from number, string, Decimal", () => {
      expect(idr(1000).amount.toString()).toBe("1000");
      expect(idr("2500000.50").amount.toString()).toBe("2500000.5");
    });

    it("zero creates a zero Money with default IDR", () => {
      expect(isZero(zero())).toBe(true);
      expect(zero().currency).toBe("IDR");
      expect(zero("USD").currency).toBe("USD");
    });
  });

  describe("arithmetic", () => {
    it("add sums same currency", () => {
      expect(equals(add(idr(100), idr(250)), idr(350))).toBe(true);
    });

    it("add throws on currency mismatch", () => {
      expect(() => add(idr(100), usd(100))).toThrow(/Currency mismatch/);
    });

    it("sub subtracts same currency", () => {
      expect(equals(sub(idr(500), idr(200)), idr(300))).toBe(true);
    });

    it("mul multiplies by factor", () => {
      expect(equals(mul(idr(1000), 0.15), idr(150))).toBe(true);
    });

    it("div divides; throws on zero divisor", () => {
      expect(equals(div(idr(1000), 4), idr(250))).toBe(true);
      expect(() => div(idr(100), 0)).toThrow(/Division by zero/);
    });

    it("neg flips sign", () => {
      expect(isPositive(neg(neg(idr(100))))).toBe(true);
    });

    it("sum of empty list is zero", () => {
      expect(isZero(sum([]))).toBe(true);
      expect(isZero(sum([idr(100), idr(-100)]))).toBe(true);
    });
  });

  describe("predicates and equality", () => {
    it("isZero / isPositive / isNegative / equals / compare", () => {
      expect(isZero(idr(0))).toBe(true);
      expect(isPositive(idr(0))).toBe(false);
      expect(isPositive(idr(1))).toBe(true);
      expect(isNegative(idr(-1))).toBe(true);
      expect(equals(idr(100), idr("100"))).toBe(true);
      expect(equals(idr(100), usd(100))).toBe(false);
      expect(compare(idr(50), idr(100))).toBe(-1);
      expect(compare(idr(100), idr(50))).toBe(1);
      expect(compare(idr(100), idr(100))).toBe(0);
    });
  });

  describe("rounding", () => {
    it("round half-up by default (0.005 -> 0.01)", () => {
      expect(round(idr("1.005"), 2).amount.toFixed(2)).toBe("1.01");
      expect(round(idr("1.004"), 2).amount.toFixed(2)).toBe("1.00");
    });

    it("round half-even (bankers)", () => {
      expect(round(idr("1.005"), 2, "half-even").amount.toFixed(2)).toBe("1.00");
      expect(round(idr("1.015"), 2, "half-even").amount.toFixed(2)).toBe("1.02");
    });

    it("round down / up", () => {
      expect(round(idr("1.999"), 2, "down").amount.toFixed(2)).toBe("1.99");
      expect(round(idr("1.001"), 2, "up").amount.toFixed(2)).toBe("1.01");
    });
  });

  describe("allocateEvenly (docs/05 §2 golden case)", () => {
    it("3.000.001 IDR / 3 nights -> [1.000.000, 1.000.000, 1.000.001]", () => {
      // IDR tidak punya sub-unit jadi alokasi per malam di docs/05 §2 pakai places=0.
      const slices = allocateEvenly(idr(3_000_001), 3, 0);
      expect(slices.map((s) => s.amount.toString())).toEqual(["1000000", "1000000", "1000001"]);
      const total = sum(slices, "IDR");
      expect(equals(total, idr(3_000_001))).toBe(true);
    });

    it("USD 100.00 / 3 -> [33.33, 33.33, 33.34] (sisa ke slot terakhir)", () => {
      const slices = allocateEvenly(usd("100.00"), 3);
      expect(slices.map((s) => s.amount.toString())).toEqual(["33.33", "33.33", "33.34"]);
      expect(equals(sum(slices, "USD"), usd("100.00"))).toBe(true);
    });

    it("parts=1 returns single rounded value", () => {
      const slices = allocateEvenly(idr("1234.56"), 1);
      expect(slices).toHaveLength(1);
      expect(slices[0]!.amount.toString()).toBe("1234.56");
    });

    it("throws on non-positive parts", () => {
      expect(() => allocateEvenly(idr(100), 0)).toThrow();
      expect(() => allocateEvenly(idr(100), 1.5)).toThrow();
    });
  });

  describe("allocateByWeights", () => {
    it("same weights reduce to allocateEvenly", () => {
      const slices = allocateByWeights(idr(900), [1, 1, 1]);
      expect(slices.map((s) => s.amount.toString())).toEqual(["300", "300", "300"]);
      expect(equals(sum(slices), idr(900))).toBe(true);
    });

    it("weights 2:1 -> 2/3 dan 1/3 dengan sisa ke elemen terakhir", () => {
      const slices = allocateByWeights(idr(1000), [2, 1]);
      expect(slices.map((s) => s.amount.toString())).toEqual(["666.67", "333.33"]);
      expect(equals(sum(slices), idr(1000))).toBe(true);
    });

    it("rejects empty / all-zero weights", () => {
      expect(() => allocateByWeights(idr(100), [])).toThrow();
      expect(() => allocateByWeights(idr(100), [0, 0])).toThrow();
      expect(() => allocateByWeights(idr(100), [-1, 2])).toThrow();
    });
  });

  describe("currency convert", () => {
    it("convert USD 100 ke IDR dengan rate 15000", () => {
      const result = convert(usd(100), "IDR", 15000);
      expect(result.currency).toBe("IDR");
      expect(result.amount.toString()).toBe("1500000");
    });

    it("convert same currency returns identity", () => {
      const same = convert(idr(100), "IDR", 99);
      expect(equals(same, idr(100))).toBe(true);
    });
  });

  describe("parseMoney (locale id-ID / en-US)", () => {
    it("id-ID: 1.500.000,00", () => {
      expect(parseMoney("1.500.000,00").toString()).toBe("1500000");
      expect(parseMoney("Rp 1.500.000,50".replace("Rp ", "")).toString()).toBe("1500000.5");
    });

    it("en-US: 1,500,000.00", () => {
      expect(parseMoney("1,500,000.00").toString()).toBe("1500000");
    });

    it("plain number", () => {
      expect(parseMoney("1500").toString()).toBe("1500");
      expect(parseMoney("1500.5").toString()).toBe("1500.5");
    });

    it("throws on empty", () => {
      expect(() => parseMoney("   ")).toThrow();
    });
  });
});
