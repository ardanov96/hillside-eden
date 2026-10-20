import { describe, it, expect } from "vitest";
import { formatIDR, formatUSD, formatCurrency, formatNumberId, formatPercentId } from "./format-id";

describe("format-id", () => {
  describe("formatIDR", () => {
    it("formats IDR with id-ID locale (titik ribuan, no decimal by default)", () => {
      expect(formatIDR(1500000)).toMatch(/Rp\s?1\.500\.000/);
    });

    it("accepts string and Decimal inputs", () => {
      expect(formatIDR("3000000")).toMatch(/3\.000\.000/);
      expect(formatIDR(1500000.5, { fractionDigits: 2 })).toMatch(/1\.500\.000,50/);
    });

    it("rounds to 0 fraction digits by default", () => {
      expect(formatIDR(1500000.7)).toMatch(/1\.500\.001/);
    });
  });

  describe("formatUSD", () => {
    it("formats USD with id-ID locale (koma decimal)", () => {
      expect(formatUSD(1500)).toMatch(/1\.500,00/);
    });

    it("supports 0 fraction digits", () => {
      expect(formatUSD(1500, { fractionDigits: 0 })).toMatch(/1\.500/);
    });
  });

  describe("formatCurrency", () => {
    it("dispatches by currency", () => {
      expect(formatCurrency(100, "IDR")).toMatch(/100/);
      expect(formatCurrency(100, "USD")).toMatch(/100,00/);
    });
  });

  describe("formatNumberId", () => {
    it("formats generic numbers with id-ID locale", () => {
      // 1500000.5 dengan fractionDigits 2 -> "1.500.000,50" (Intl pads ke minFractionDigits).
      expect(formatNumberId(1500000.5, { fractionDigits: 2 })).toBe("1.500.000,50");
      expect(formatNumberId(1500000)).toBe("1.500.000");
      expect(formatNumberId(0.123, { fractionDigits: 3 })).toBe("0,123");
    });
  });

  describe("formatPercentId", () => {
    it("formats 0..1 as percent", () => {
      expect(formatPercentId(0.15)).toBe("15,0%");
    });
  });
});
