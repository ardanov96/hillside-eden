import { describe, it, expect } from "vitest";
import { parseOtaAmount, parseOtaDate } from "@/adapters/common/parse-utils";

describe("parseOtaAmount (Bug 1: Locale Number Parsing)", () => {
  it("menangani format angka Indonesia dengan titik ribuan (15.000.000)", () => {
    expect(parseOtaAmount("15.000.000")).toBe("15000000.00");
    expect(parseOtaAmount("850.000")).toBe("850000.00");
    expect(parseOtaAmount("1.250.000,50")).toBe("1250000.50");
    expect(parseOtaAmount("Rp 12.000.000")).toBe("12000000.00");
    expect(parseOtaAmount("Rp. 7.500.000,00")).toBe("7500000.00");
  });

  it("menangani format angka internasional US/UK dengan koma ribuan (15,000,000.50)", () => {
    expect(parseOtaAmount("15,000,000")).toBe("15000000.00");
    expect(parseOtaAmount("15,000,000.50")).toBe("15000000.50");
    expect(parseOtaAmount("$1,500.00")).toBe("1500.00");
    expect(parseOtaAmount("USD 150.50")).toBe("150.50");
  });

  it("menangani angka negatif dan kurung akuntansi", () => {
    expect(parseOtaAmount("-500000")).toBe("-500000.00");
    expect(parseOtaAmount("(1.200.000)")).toBe("-1200000.00");
    expect(parseOtaAmount("(150.50)")).toBe("-150.50");
  });

  it("menangani nilai kosong, null, atau tidak terdefinisi secara aman", () => {
    expect(parseOtaAmount(null)).toBe("0.00");
    expect(parseOtaAmount(undefined)).toBe("0.00");
    expect(parseOtaAmount("")).toBe("0.00");
    expect(parseOtaAmount("   ")).toBe("0.00");
    expect(parseOtaAmount("invalid")).toBe("0.00");
  });
});

describe("parseOtaDate (Bug 2: Multi-format Date Parsing)", () => {
  it("mengenali tanggal format ISO (YYYY-MM-DD)", () => {
    expect(parseOtaDate("2026-11-01")).toBe("2026-11-01");
    expect(parseOtaDate("2026-12-31")).toBe("2026-12-31");
  });

  it("mengenali tanggal format garis miring Indonesia/Eropa (DD/MM/YYYY)", () => {
    expect(parseOtaDate("25/11/2026")).toBe("2026-11-25");
    expect(parseOtaDate("05-11-2026")).toBe("2026-11-05");
  });

  it("mengenali tanggal format dengan nama bulan Indonesia dan Inggris", () => {
    expect(parseOtaDate("25 Nov 2026")).toBe("2026-11-25");
    expect(parseOtaDate("5 November 2026")).toBe("2026-11-05");
    expect(parseOtaDate("20 Okt 2026")).toBe("2026-10-20");
    expect(parseOtaDate("October 20, 2026")).toBe("2026-10-20");
  });

  it("mengembalikan undefined untuk nilai kosong atau tidak valid", () => {
    expect(parseOtaDate("")).toBeUndefined();
    expect(parseOtaDate(null)).toBeUndefined();
    expect(parseOtaDate(undefined)).toBeUndefined();
    expect(parseOtaDate("bukan-tanggal")).toBeUndefined();
  });
});
